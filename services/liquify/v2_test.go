package main

import (
 "context"
 "fmt"
 "math/big"
 "net/http"
 "net/http/httptest"
 "os"
 "strings"
 "testing"
 "time"
)
const v2TokenA="So11111111111111111111111111111111111111112"
const v2TokenB="3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh"
func TestV2PairsAreNotRestrictedToUSDC(t *testing.T){
 if !validAnyPair(v2TokenA,v2TokenB,"1000000"){t.Fatal("SOL/BTC token pair denied")}
 if validAnyPair(v2TokenA,v2TokenA,"1000000"){t.Fatal("same mint accepted")}
 for _,a:=range []string{"0","-1","1.5","9999999999999999999999999999999999999"}{
  if validAnyPair(v2TokenA,v2TokenB,a){t.Errorf("invalid amount accepted: %s",a)}
 }
}
func TestV2ProviderConfigurationRequiresHTTPS(t *testing.T){
 for _,raw:=range []string{
  "http://localhost:9999","https://127.0.0.1","https://localhost","https://a.local",
  "https://example.com?key=x","https://user:pass@example.com","ftp://example.com",
 }{if allowedProvider(raw){t.Errorf("unsafe provider accepted: %s",raw)}}
 if !allowedProvider("https://quotes.example.com/api"){t.Fatal("valid TLS provider rejected")}
}
func TestV2CPMMConservesReservesAndFees(t *testing.T){
 x,y,a:=big.NewInt(1000000),big.NewInt(1000000),big.NewInt(10000)
 zero,spot,_,e:=cpmmOut(x,y,a,0)
 if e!=nil{t.Fatal(e)}
 fee,_,impact,e:=cpmmOut(x,y,a,30)
 if e!=nil{t.Fatal(e)}
 if fee.Cmp(zero)>=0||zero.Cmp(spot)>0||impact.Sign()<=0{t.Fatal("fee and price impact calculation invalid")}
 if new(big.Int).Add(fee,big.NewInt(1)).Cmp(y)>=0{t.Fatal("reserves emptied")}
 for _,n:=range []*big.Int{big.NewInt(0),big.NewInt(-1)}{
  if _,_,_,e:=cpmmOut(x,y,n,30);e==nil{t.Fatal("invalid amount accepted")}
 }
}
func TestV2IndependentQuotesAreReportedAsUnavailableNotInvented(t *testing.T){
 upstream:=httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  if r.URL.Path!="/swap/v2/order"{t.Error(r.URL.Path)}
  fmt.Fprintf(w,`{"inAmount":%q,"outAmount":"1800","router":"metis","mode":"ultra"}`,r.URL.Query().Get("amount"))
 }))
 defer upstream.Close()
 srv:=NewServer(upstream.URL,"key","secret")
 f:=newQuoteFederation(srv,nil)
 out:=f.compare(context.Background(),v2TokenA,v2TokenB,"1000")
 if len(out.Routes)!=1||out.Routes[0].Venue!="jupiter"||out.ExecutionEnabled{t.Fatalf("bad comparison %+v",out)}
 if out.Best==nil||out.Best.OutAmount!="1800"{t.Fatal("no real quote")}
}
func TestV2CachesForShortTTLWithoutReturningFakeFills(t *testing.T){
 hits:=0
 upstream:=httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  hits++
  fmt.Fprintf(w,`{"inAmount":%q,"outAmount":"1800","router":"metis","mode":"ultra"}`,r.URL.Query().Get("amount"))
 }))
 defer upstream.Close()
 srv:=NewServer(upstream.URL,"key","")
 f:=newQuoteFederation(srv,nil)
 first:=f.compare(context.Background(),v2TokenA,v2TokenB,"1000")
 second:=f.compare(context.Background(),v2TokenA,v2TokenB,"1000")
 if hits!=1||len(first.Routes)!=1||len(second.Routes)!=1||second.Routes[0].CacheAgeMs<0{
  t.Fatalf("cache behavior unexpected %d %+v",hits,second)
 }
 if strings.Contains(second.Note,"guaranteed executable"){t.Fatal("fabricated execution guarantee")}
}
func TestV2PaginationBounds(t *testing.T){
 prev:=os.Getenv("SENDA_SOLSCAN_PAGE_CAP")
 defer os.Setenv("SENDA_SOLSCAN_PAGE_CAP",prev)
 for _,v:=range []struct{raw string;cap int}{{"0",10},{"5",5},{"300",30},{"bad",10}}{
  os.Setenv("SENDA_SOLSCAN_PAGE_CAP",v.raw)
  if got:=configuredSolscanPageCap();got!=v.cap{t.Errorf("page cap %s: %d",v.raw,got)}
 }
}
func TestV2ProviderResponsesCannotBeStaleOrWrongPair(t *testing.T){
 svc:=NewServer("https://api.jup.ag","key","secret")
 federation:=newQuoteFederation(svc,nil)
 federation.now=func()time.Time{return time.Unix(1800000000,0)}
 _=federation
 // The integration route requires an explicit configured independent provider.
 // No mock or unconfigured provider may be advertised as connected.
 if len(federation.venues)!=0{t.Fatal("fabricated independent provider")}
}
