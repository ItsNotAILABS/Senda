package main

// Liquify V2: evidence-separated, read-only multi-source quote comparisons.
// A route observation never confers transaction authority.
import (
 "context"
 "encoding/json"
 "errors"
 "fmt"
 "io"
 "math/big"
 "net"
 "net/http"
 "net/url"
 "os"
 "regexp"
 "sort"
 "strings"
 "sync"
 "time"
)

const wrappedSOL = "So11111111111111111111111111111111111111112"
const usdtMint = "Es9vMFrzaCERQ9X4gYpjXar5e23v3ZJfvYxC5kTgBLz"
var venueID = regexp.MustCompile(`^[a-z][a-z0-9_-]{1,31}$`)

type venueConfig struct {
 ID string `json:"id"`
 URL string `json:"url"`
 Key string `json:"key"`
}
type routeV2 struct {
 Venue string `json:"venue"`
 InputMint string `json:"inputMint"`
 OutputMint string `json:"outputMint"`
 InAmount string `json:"inAmount"`
 OutAmount string `json:"outAmount"`
 ObservedAt time.Time `json:"observedAt"`
 CacheAgeMs int64 `json:"cacheAgeMs"`
 Router string `json:"router"`
 PriceSource string `json:"priceSource"`
 State string `json:"state"`
}
type compareV2 struct {
 Schema string `json:"schema"`
 InputMint string `json:"inputMint"`
 OutputMint string `json:"outputMint"`
 Amount string `json:"amount"`
 Routes []routeV2 `json:"routes"`
 Rejected []string `json:"rejected"`
 Best *routeV2 `json:"best,omitempty"`
 ObservedAt time.Time `json:"observedAt"`
 ExecutionEnabled bool `json:"executionEnabled"`
 Note string `json:"note"`
}
type routeCacheEntry struct{ route routeV2; expires time.Time }
type quoteFederation struct{
 server *Server
 venues []venueConfig
 client *http.Client
 mu sync.Mutex
 cache map[string]routeCacheEntry
 now func()time.Time
}
func allowedProvider(raw string)bool {
 u,e:=url.Parse(raw)
 if e!=nil||u.Scheme!="https"||u.User!=nil||u.RawQuery!=""||u.Fragment!=""||u.Hostname()==""{return false}
 h:=strings.ToLower(u.Hostname())
 if h=="localhost"||strings.HasSuffix(h,".localhost")||strings.HasSuffix(h,".local")||strings.HasSuffix(h,".internal"){return false}
 if net.ParseIP(h)!=nil{return false}
 return strings.Contains(h,".")
}
func configuredVenues()([]venueConfig,error){
 raw:=os.Getenv("SENDA_LIQUIFY_VENUES_JSON")
 if raw==""{return nil,nil}
 var rows []venueConfig
 if err:=json.Unmarshal([]byte(raw),&rows);err!=nil{return nil,err}
 if len(rows)>6{return nil,errors.New("too many configured venues")}
 seen:=map[string]bool{"jupiter":true}
 for _,v:=range rows{
  if !venueID.MatchString(v.ID)||seen[v.ID]||!allowedProvider(v.URL){
   return nil,errors.New("unsafe or duplicate venue configuration")
  }
  seen[v.ID]=true
 }
 return rows,nil
}
func newQuoteFederation(server *Server,venues []venueConfig)*quoteFederation{
 // Only the server operator configures independent providers; none are synthesized.
 return &quoteFederation{server:server,venues:venues,
  client:&http.Client{Timeout:7*time.Second,CheckRedirect:func(*http.Request,[]*http.Request)error{return http.ErrUseLastResponse}},
  cache:make(map[string]routeCacheEntry),now:time.Now}
}
func validAnyPair(in,out,amount string)bool{
 if !mintPattern.MatchString(in)||!mintPattern.MatchString(out)||in==out||!digits.MatchString(amount){return false}
 n,ok:=new(big.Int).SetString(amount,10)
 return ok&&n.Sign()>0&&n.BitLen()<=64&&n.Cmp(big.NewInt(1000000000000))<=0
}
func (f *quoteFederation) cached(ctx context.Context,k string,fn func(context.Context)(routeV2,error))(routeV2,error){
 now:=f.now()
 f.mu.Lock()
 if r,ok:=f.cache[k];ok&&now.Before(r.expires){
  v:=r.route;v.CacheAgeMs=now.Sub(v.ObservedAt).Milliseconds();f.mu.Unlock();return v,nil
 }
 f.mu.Unlock()
 v,e:=fn(ctx)
 if e!=nil{return routeV2{},e}
 f.mu.Lock()
 if len(f.cache)>512{
  for key,x:=range f.cache{if !now.Before(x.expires){delete(f.cache,key)}}
  if len(f.cache)>512{f.cache=make(map[string]routeCacheEntry)}
 }
 f.cache[k]=routeCacheEntry{route:v,expires:f.now().Add(1500*time.Millisecond)}
 f.mu.Unlock()
 return v,nil
}
func (f *quoteFederation) jupiter(ctx context.Context,in,out,amount string)(routeV2,error){
 q,e:=f.server.quote(ctx,in,out,amount)
 if e!=nil{return routeV2{},e}
 if !q.Available||q.ErrorMessage!=""||q.ErrorCode!=nil{return routeV2{},errors.New("Jupiter rejected quote")}
 return routeV2{Venue:"jupiter",InputMint:in,OutputMint:out,InAmount:amount,
  OutAmount:q.OutAmount,ObservedAt:q.ObservedAt,Router:q.Router,PriceSource:"Jupiter Swap V2 order",State:"indicative-quote"},nil
}
func (f *quoteFederation) independent(ctx context.Context,v venueConfig,in,out,amount string)(routeV2,error){
 root,e:=url.Parse(v.URL)
 if e!=nil{return routeV2{},e}
 // Provider must implement this exact server-to-server contract.
 reqURL:=root.ResolveReference(&url.URL{Path:strings.TrimSuffix(root.Path,"/")+"/quote"})
 qs:=reqURL.Query()
 qs.Set("inputMint",in);qs.Set("outputMint",out);qs.Set("amount",amount)
 reqURL.RawQuery=qs.Encode()
 req,e:=http.NewRequestWithContext(ctx,"GET",reqURL.String(),nil)
 if e!=nil{return routeV2{},e}
 req.Header.Set("accept","application/json")
 if v.Key!=""{req.Header.Set("x-api-key",v.Key)}
 resp,e:=f.client.Do(req)
 if e!=nil{return routeV2{},e}
 defer resp.Body.Close()
 if resp.StatusCode!=200{return routeV2{},fmt.Errorf("provider HTTP %d",resp.StatusCode)}
 var q struct {
  InputMint string `json:"inputMint"`
  OutputMint string `json:"outputMint"`
  InAmount string `json:"inAmount"`
  OutAmount string `json:"outAmount"`
  Router string `json:"router"`
  ObservedAt time.Time `json:"observedAt"`
  Error string `json:"error"`
 }
 if err:=json.NewDecoder(io.LimitReader(resp.Body,1<<20)).Decode(&q);err!=nil{return routeV2{},errors.New("invalid provider response")}
 if q.InputMint!=in||q.OutputMint!=out||q.InAmount!=amount||!digits.MatchString(q.OutAmount)||q.Error!=""||
   q.Router==""||q.ObservedAt.IsZero()||q.ObservedAt.After(f.now().Add(time.Second))||
   f.now().Sub(q.ObservedAt)>3*time.Second{return routeV2{},errors.New("invalid, mismatched or stale provider quote")}
 return routeV2{Venue:v.ID,InputMint:in,OutputMint:out,InAmount:amount,OutAmount:q.OutAmount,
  ObservedAt:q.ObservedAt,Router:q.Router,PriceSource:"configured-independent-provider",State:"indicative-quote"},nil
}
func sortRoutes(rs []routeV2){
 sort.Slice(rs,func(i,j int)bool{
  a,_:=new(big.Int).SetString(rs[i].OutAmount,10)
  b,_:=new(big.Int).SetString(rs[j].OutAmount,10)
  c:=a.Cmp(b)
  if c!=0{return c>0}
  return rs[i].Venue<rs[j].Venue
 })
}
func (f *quoteFederation) compare(ctx context.Context,in,out,amount string)compareV2{
 result:=compareV2{Schema:"senda.liquify.compare.v2",InputMint:in,OutputMint:out,Amount:amount,
  Routes:[]routeV2{},Rejected:[]string{},ObservedAt:f.now().UTC(),ExecutionEnabled:false,
  Note:"Quotes are indicative; venues have different settlement, fees and access conditions. No executable order or guaranteed liquidity."}
 type answer struct{r routeV2;name string;err error}
 ch:=make(chan answer,len(f.venues)+1)
 call:=func(name string,fn func(context.Context)(routeV2,error)){
  v,e:=f.cached(ctx,name+"|"+in+"|"+out+"|"+amount,fn)
  ch<-answer{r:v,name:name,err:e}
 }
 go call("jupiter",func(ctx context.Context)(routeV2,error){return f.jupiter(ctx,in,out,amount)})
 for _,v:=range f.venues{
  v:=v;go call(v.ID,func(ctx context.Context)(routeV2,error){return f.independent(ctx,v,in,out,amount)})
 }
 for i:=0;i<len(f.venues)+1;i++{
  select{
  case a:=<-ch:
   if a.err!=nil{result.Rejected=append(result.Rejected,a.name+": unavailable");continue}
   result.Routes=append(result.Routes,a.r)
  case <-ctx.Done():
   result.Rejected=append(result.Rejected,"timeout: missing venue observations")
   return result
  }
 }
 sortRoutes(result.Routes)
 if len(result.Routes)>0{result.Best=&result.Routes[0]}
 return result
}
func (f *quoteFederation) handler(w http.ResponseWriter,r *http.Request){
 if !f.server.authorized(w,r){return}
 if r.Method!="GET"{writeJSON(w,405,map[string]string{"error":"GET only"});return}
 in,out,amount:=r.URL.Query().Get("inputMint"),r.URL.Query().Get("outputMint"),r.URL.Query().Get("amount")
 if !validAnyPair(in,out,amount){writeJSON(w,400,map[string]string{"error":"valid distinct Solana mints and bounded raw amount required"});return}
 ctx,cancel:=context.WithTimeout(r.Context(),10*time.Second);defer cancel()
 comparison:=f.compare(ctx,in,out,amount)
 if len(comparison.Routes)==0{writeJSON(w,503,comparison);return}
 writeJSON(w,200,comparison)
}
