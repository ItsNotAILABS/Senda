// SENDA Liquify: quote-only, server-side liquidity measurements.
// No secrets, signing keys, swaps, custody, deposits or fabricated order books.
package main

import (
 "context"
 "encoding/json"
 "errors"
 "fmt"
 "io"
 "log"
 "net"
 "net/http"
 "net/url"
 "os"
 "regexp"
 "sort"
 "strconv"
 "strings"
 "sync"
 "time"
)

const usdc = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
const maxUSD = 10000
var mintPattern = regexp.MustCompile(`^[1-9A-HJ-NP-Za-km-z]{32,44}$`)
var digits = regexp.MustCompile(`^[1-9][0-9]{0,19}$`)

type Quote struct {
 InputMint string `json:"inputMint"`
 OutputMint string `json:"outputMint"`
 InAmount string `json:"inAmount"`
 OutAmount string `json:"outAmount"`
 Router string `json:"router"`
 Mode string `json:"mode"`
 FeeBps *float64 `json:"feeBps"`
 ErrorCode *int `json:"errorCode,omitempty"`
 ErrorMessage string `json:"errorMessage,omitempty"`
 Available bool `json:"available"`
 ObservedAt time.Time `json:"observedAt"`
}
type LadderRow struct {
 USD int `json:"usd"`
 Status string `json:"status"`
 Quote *Quote `json:"quote,omitempty"`
 Reason string `json:"reason,omitempty"`
}
type Ladder struct {
 Mint string `json:"mint"`
 Pair string `json:"pair"`
 Kind string `json:"kind"`
 ObservedAt time.Time `json:"observedAt"`
 Sizes []LadderRow `json:"sizes"`
 Note string `json:"note"`
}
type Server struct {
 client *http.Client
 upstream string
 apiKey string
 internalSecret string
 mu sync.Mutex
 next time.Time
 // Inflight/rate controls protect the venue, not a market maker.
 slots chan struct{}
}
func NewServer(upstream,key,secret string)*Server{
 return &Server{client:&http.Client{Timeout:6*time.Second},upstream:strings.TrimSuffix(upstream,"/"),
  apiKey:key,internalSecret:secret,slots:make(chan struct{},3)}
}
func validPair(in,out string)bool{
 return mintPattern.MatchString(in)&&mintPattern.MatchString(out)&&in!=out&&(in==usdc||out==usdc)
}
func writeJSON(w http.ResponseWriter,status int,value any){
 w.Header().Set("Content-Type","application/json; charset=utf-8")
 w.Header().Set("Cache-Control","no-store")
 w.WriteHeader(status)
 _=json.NewEncoder(w).Encode(value)
}
func (s *Server) authorized(w http.ResponseWriter,r *http.Request)bool{
 if s.internalSecret==""{return true}
 if r.Header.Get("X-Senda-Router-Key")!=s.internalSecret{
  writeJSON(w,http.StatusUnauthorized,map[string]string{"error":"Private Senda router token required"})
  return false
 }
 return true
}
func (s *Server) pacing(ctx context.Context)error{
 // Jupiter keyless is 0.5 RPS. Never fan out an unthrottled burst.
 if s.apiKey!="" {return nil}
 s.mu.Lock()
 now:=time.Now()
 at:=s.next
 if at.Before(now){at=now}
 s.next=at.Add(2100*time.Millisecond)
 s.mu.Unlock()
 wait:=time.Until(at)
 if wait<=0{return nil}
 timer:=time.NewTimer(wait);defer timer.Stop()
 select{case <-ctx.Done():return ctx.Err();case <-timer.C:return nil}
}
func (s *Server) quote(ctx context.Context,input,output,amount string)(*Quote,error){
 if !validPair(input,output)||!digits.MatchString(amount){return nil,errors.New("invalid pair or raw input")}
 n,e:=strconv.ParseUint(amount,10,64)
 if e!=nil||n==0||n>1000000000000{return nil,errors.New("raw amount exceeds quote limits")}
 select {case s.slots<-struct{}{}:defer func(){<-s.slots}();case <-ctx.Done():return nil,ctx.Err()}
 if err:=s.pacing(ctx);err!=nil{return nil,err}
 params:=url.Values{"inputMint":{input},"outputMint":{output},"amount":{amount}}
 req,e:=http.NewRequestWithContext(ctx,http.MethodGet,s.upstream+"/swap/v2/order?"+params.Encode(),nil)
 if e!=nil{return nil,e}
 req.Header.Set("Accept","application/json")
 if s.apiKey!=""{req.Header.Set("x-api-key",s.apiKey)}
 resp,e:=s.client.Do(req)
 if e!=nil{return nil,e}
 defer resp.Body.Close()
 if resp.StatusCode!=http.StatusOK{return nil,fmt.Errorf("upstream HTTP %d",resp.StatusCode)}
 limited:=io.LimitReader(resp.Body,1<<20)
 var raw struct {
  InAmount string `json:"inAmount"`
  OutAmount string `json:"outAmount"`
  Router string `json:"router"`
  Mode string `json:"mode"`
  FeeBps *float64 `json:"feeBps"`
  ErrorCode *int `json:"errorCode"`
  ErrorMessage string `json:"errorMessage"`
 }
 if e=json.NewDecoder(limited).Decode(&raw);e!=nil{return nil,errors.New("invalid upstream quote")}
 if !digits.MatchString(raw.OutAmount)||!digits.MatchString(raw.InAmount){return nil,errors.New("no positive upstream output")}
 if raw.InAmount!=amount{return nil,errors.New("quoted amount mismatch")}
 if raw.Router==""{return nil,errors.New("no router available")}
 return &Quote{InputMint:input,OutputMint:output,InAmount:raw.InAmount,OutAmount:raw.OutAmount,
  Router:raw.Router,Mode:raw.Mode,FeeBps:raw.FeeBps,ErrorCode:raw.ErrorCode,ErrorMessage:raw.ErrorMessage,
  Available:raw.ErrorCode==nil,ObservedAt:time.Now().UTC()},nil
}
func (s *Server) routes(w http.ResponseWriter,r *http.Request){
 if !s.authorized(w,r){return}
 if r.Method!=http.MethodGet{writeJSON(w,405,map[string]string{"error":"GET only"});return}
 input:=r.URL.Query().Get("inputMint")
 output:=r.URL.Query().Get("outputMint")
 amount:=r.URL.Query().Get("amount")
 if !validPair(input,output)||!digits.MatchString(amount){writeJSON(w,400,map[string]string{"error":"Valid USDC pair and raw amount required"});return}
 ctx,cancel:=context.WithTimeout(r.Context(),12*time.Second);defer cancel()
 q,e:=s.quote(ctx,input,output,amount)
 if e!=nil{writeJSON(w,503,map[string]string{"error":"No verified route: "+e.Error()});return}
 writeJSON(w,200,q)
}
func (s *Server) ladder(w http.ResponseWriter,r *http.Request){
 if !s.authorized(w,r){return}
 if r.Method!=http.MethodGet{writeJSON(w,405,map[string]string{"error":"GET only"});return}
 mint:=r.URL.Query().Get("mint")
 if !mintPattern.MatchString(mint)||mint==usdc{writeJSON(w,400,map[string]string{"error":"Valid non-USDC mint required"});return}
 // Fixed, bounded quote-only $ sizes. Never submit the resulting transactions.
 sizes:=[]int{5,25,100,250}
 ctx,cancel:=context.WithTimeout(r.Context(),16*time.Second);defer cancel()
 rows:=make([]LadderRow,len(sizes))
 var group sync.WaitGroup
 for i,size:=range sizes {
  group.Add(1)
  go func(i,size int){
   defer group.Done()
   amount:=strconv.FormatInt(int64(size)*1000000,10)
   q,e:=s.quote(ctx,usdc,mint,amount)
   rows[i]=LadderRow{USD:size,Status:"available",Quote:q}
   if e!=nil{rows[i]=LadderRow{USD:size,Status:"unavailable",Reason:e.Error()};return}
   if !q.Available{rows[i].Status="unavailable";rows[i].Reason="Quoted price but upstream could not build an executable route"}
  }(i,size)
 }
 group.Wait()
 sort.Slice(rows,func(i,j int)bool{return rows[i].USD<rows[j].USD})
 writeJSON(w,200,Ladder{Mint:mint,Pair:"USDC → token",Kind:"quote-size-curve",
  ObservedAt:time.Now().UTC(),Sizes:rows,
  Note:"Indicative Jupiter V2 order quotes, NOT resting bids/asks or guaranteed executable inventory. RFQ may expire immediately. Wallet must fetch a fresh taker-bound order and sign."})
}
func (s *Server) mux()*http.ServeMux{
 m:=http.NewServeMux()
 m.HandleFunc("/healthz",func(w http.ResponseWriter,r *http.Request){
  writeJSON(w,200,map[string]any{"status":"ok","service":"senda-liquify","mode":"read-only","keysHeld":false})
 })
 m.HandleFunc("/v1/quote",s.routes)
 m.HandleFunc("/v1/ladder",s.ladder)
 return m
}
func main(){
 addr:=os.Getenv("SENDA_ROUTER_LISTEN")
 if addr==""{addr="127.0.0.1:8787"}
 host,_,err:=net.SplitHostPort(addr)
 if err!=nil{log.Fatal("invalid listen address: ",err)}
 secret:=os.Getenv("SENDA_ROUTER_INTERNAL_KEY")
 if host!="127.0.0.1"&&host!="localhost"&&host!="::1"&&secret==""{
  log.Fatal("refusing non-loopback bind without SENDA_ROUTER_INTERNAL_KEY")
 }
 key:=os.Getenv("SENDA_JUPITER_API_KEY")
 srv:=NewServer("https://api.jup.ag",key,secret)
 server:=&http.Server{Addr:addr,Handler:srv.mux(),ReadHeaderTimeout:5*time.Second,
  ReadTimeout:8*time.Second,WriteTimeout:20*time.Second,IdleTimeout:30*time.Second}
 log.Printf("Senda Liquify read-only router listening on %s (key configured: %t)",addr,key!="")
 log.Fatal(server.ListenAndServe())
}
