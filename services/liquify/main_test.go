package main

import (
 "context"
 "encoding/json"
 "fmt"
 "net/http"
 "net/http/httptest"
 "net/url"
 "strconv"
 "strings"
 "testing"
 "time"
)
const testMint = "So11111111111111111111111111111111111111112"
func testUpstream(t *testing.T)*httptest.Server{
 t.Helper()
 server:=httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  if r.URL.Path!="/swap/v2/order"{t.Errorf("path %s",r.URL.Path);w.WriteHeader(404);return}
  if r.URL.Query().Get("taker")!=""{t.Error("quote-only request must not specify a taker")}
  in:=r.URL.Query().Get("amount")
  if _,err:=strconv.ParseUint(in,10,64);err!=nil{t.Errorf("bad raw input: %s",in)}
  w.Header().Set("Content-Type","application/json")
  fmt.Fprintf(w,`{"inAmount":%q,"outAmount":"123456","router":"metis","mode":"ultra","feeBps":5}`,in)
 }))
 t.Cleanup(server.Close)
 return server
}
func TestQuoteOnlyProducesVerifiedRawAmounts(t *testing.T){
 upstream:=testUpstream(t)
 service:=NewServer(upstream.URL,"test-key","test-secret")
 req:=httptest.NewRequest("GET","/v1/quote?inputMint="+usdc+"&outputMint="+testMint+"&amount=5000000",nil)
 req.Header.Set("X-Senda-Router-Key","test-secret")
 rec:=httptest.NewRecorder()
 service.mux().ServeHTTP(rec,req)
 if rec.Code!=200{t.Fatalf("unexpected HTTP %d: %s",rec.Code,rec.Body.String())}
 var response Quote
 if err:=json.Unmarshal(rec.Body.Bytes(),&response);err!=nil{t.Fatal(err)}
 if !response.Available||response.Router!="metis"||response.InAmount!="5000000"||response.OutAmount!="123456"{t.Fatalf("bad quote %+v",response)}
 if !strings.Contains(rec.Header().Get("Cache-Control"),"no-store"){t.Fatal("response should be non-cacheable")}
}
func TestLadderUsesOnlyRealQuotesAndRawIntegers(t *testing.T){
 upstream:=testUpstream(t)
 service:=NewServer(upstream.URL,"test-key","")
 req:=httptest.NewRequest("GET","/v1/ladder?mint="+testMint,nil)
 rec:=httptest.NewRecorder()
 service.mux().ServeHTTP(rec,req)
 if rec.Code!=200{t.Fatalf("HTTP %d %s",rec.Code,rec.Body.String())}
 var ladder Ladder
 if err:=json.Unmarshal(rec.Body.Bytes(),&ladder);err!=nil{t.Fatal(err)}
 expected:=[]int{5,25,100,250}
 if len(ladder.Sizes)!=4||ladder.Kind!="quote-size-curve"{t.Fatalf("invalid ladder %+v",ladder)}
 for i,row:=range ladder.Sizes{
  if row.USD!=expected[i]||row.Status!="available"||row.Quote==nil{t.Fatalf("bad rung %+v",row)}
  if row.Quote.InAmount!=strconv.Itoa(expected[i]*1_000_000){t.Fatalf("wrong raw input %s",row.Quote.InAmount)}
 }
}
func TestUnauthorizedRequestsNeverCallUpstream(t *testing.T){
 count:=0
 upstream:=httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){count++}))
 defer upstream.Close()
 service:=NewServer(upstream.URL,"test-key","a-private-key")
 req:=httptest.NewRequest("GET","/v1/ladder?mint="+testMint,nil)
 rec:=httptest.NewRecorder()
 service.mux().ServeHTTP(rec,req)
 if rec.Code!=401||count!=0{t.Fatalf("unauthorized status %d upstream calls %d",rec.Code,count)}
}
func TestMalformedPairsAndAmountsRejected(t *testing.T){
 service:=NewServer("http://127.0.0.1:1","test-key","")
 cases:=[]string{
  "/v1/ladder?mint=not-a-mint",
  "/v1/ladder?mint="+usdc,
  "/v1/quote?inputMint="+testMint+"&outputMint="+testMint+"&amount=1",
  "/v1/quote?inputMint="+usdc+"&outputMint="+testMint+"&amount=1.2",
  "/v1/quote?inputMint="+usdc+"&outputMint="+testMint+"&amount=-5",
  "/v1/quote?inputMint="+usdc+"&outputMint="+testMint+"&amount=000001",
 }
 for _,path:=range cases{
  r:=httptest.NewRecorder()
  service.mux().ServeHTTP(r,httptest.NewRequest("GET",path,nil))
  if r.Code!=400{t.Errorf("%s: wanted 400, got %d",path,r.Code)}
 }
 if !validPair(usdc,testMint){t.Fatal("valid route rejected")}
}
func TestWrongAmountFailsClosed(t *testing.T){
 upstream:=httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  fmt.Fprint(w,`{"inAmount":"1","outAmount":"123","router":"metis"}`)
 }))
 defer upstream.Close()
 service:=NewServer(upstream.URL,"test-key","")
 _,err:=service.quote(context.Background(),usdc,testMint,"5000000")
 if err==nil||!strings.Contains(err.Error(),"mismatch"){t.Fatalf("wanted mismatch, got %v",err)}
}
func TestUnquotedOutputCannotBeCalledAvailable(t *testing.T){
 upstream:=httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  fmt.Fprint(w,`{"inAmount":"5000000","outAmount":"0","router":"metis","errorCode":1}`)
 }))
 defer upstream.Close()
 service:=NewServer(upstream.URL,"test-key","")
 _,err:=service.quote(context.Background(),usdc,testMint,"5000000")
 if err==nil{t.Fatal("zero output must fail closed")}
}
func TestOnlyLoopbackCanBeKeyless(t *testing.T){
 host,_,err:=netSplit("127.0.0.1:8787")
 if err!=nil||host!="127.0.0.1"{t.Fatal("loopback invalid")}
}
func netSplit(s string)(string,string,error){
 uri,err:=url.Parse("http://"+s)
 if err!=nil{return "","",err}
 return uri.Hostname(),uri.Port(),nil
}
var _ = time.Second
