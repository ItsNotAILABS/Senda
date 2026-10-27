package main

// Solscan Pro indexed on-chain swap bars. USDC raw notional is the only priced lane.
// It is a read-only lower-bound index, never an order book or trade execution signal.
import (
 "context"
 "encoding/json"
 "errors"
 "fmt"
 "io"
 "net/http"
 "net/url"
 "regexp"
 "strconv"
 "strings"
 "time"
)
const solscanEndpoint="https://pro-api.solscan.io/v2.0/token/defi/activities"
const solscanPageCap=5
const solscanPageSize=100
var solscanSignature=regexp.MustCompile(`^[1-9A-HJ-NP-Za-km-z]{32,100}$`)
type solscanRoute struct {
 Token1 string `json:"token1"`
 Token2 string `json:"token2"`
 Decimals1 int `json:"token1_decimals"`
 Decimals2 int `json:"token2_decimals"`
 Amount1 json.Number `json:"amount1"`
 Amount2 json.Number `json:"amount2"`
}
type solscanActivity struct {
 Signature string `json:"trans_id"`
 BlockTime int64 `json:"block_time"`
 Type string `json:"activity_type"`
 Router solscanRoute `json:"routers"`
}
type solscanResponse struct {
 Success bool `json:"success"`
 Data []solscanActivity `json:"data"`
}
type volumeBar struct {
 T int64 `json:"t"`
 BuyUsd *float64 `json:"buyUsd"`
 SellUsd *float64 `json:"sellUsd"`
 TotalUsd *float64 `json:"totalUsd"`
 NetUsd *float64 `json:"netUsd"`
 Trades *int `json:"trades"`
 Observed bool `json:"observed"`
}
type volumeIndex struct {
 Schema string `json:"schema"`
 Mint string `json:"mint"`
 Source string `json:"source"`
 Unit string `json:"unit"`
 Basis string `json:"basis"`
 Direction string `json:"direction"`
 Interval string `json:"interval"`
 From int64 `json:"from"`
 To int64 `json:"to"`
 ObservedAt string `json:"observedAt"`
 Complete bool `json:"complete"`
 Coverage string `json:"coverage"`
 PricedSwaps int `json:"pricedSwaps"`
 UnpricedSwaps int `json:"unpricedSwaps"`
 TotalSwapsObserved int `json:"totalSwapsObserved"`
 BuyUsd float64 `json:"buyUsd"`
 SellUsd float64 `json:"sellUsd"`
 ObservedUsd float64 `json:"observedUsd"`
 Bars []volumeBar `json:"bars"`
 Note string `json:"note"`
}
type indexedSwap struct{ signature,kind,side string; epoch int64; nominal float64; priced bool }
func stableRaw(value json.Number,decimals int)(float64,bool){
 if decimals!=6{return 0,false}
 raw:=value.String()
 if len(raw)==0||len(raw)>20{return 0,false}
 for _,c:=range raw {if c<'0'||c>'9'{return 0,false}}
 n,err:=strconv.ParseUint(raw,10,64)
 if err!=nil||n==0||n>9007199254740991{return 0,false}
 return float64(n)/1e6,true
}
func parseSwap(input solscanActivity,mint string,from,to int64)(indexedSwap,bool){
 if input.BlockTime<from||input.BlockTime>=to||!solscanSignature.MatchString(input.Signature){return indexedSwap{},false}
 if input.Type!="ACTIVITY_AGG_TOKEN_SWAP"&&input.Type!="ACTIVITY_TOKEN_SWAP"{return indexedSwap{},false}
 r:=input.Router
 v:=indexedSwap{signature:input.Signature,kind:input.Type,epoch:input.BlockTime}
 if r.Token1==usdc&&r.Token2==mint{
  v.side="buy";v.nominal,v.priced=stableRaw(r.Amount1,r.Decimals1)
 }else if r.Token2==usdc&&r.Token1==mint{
  v.side="sell";v.nominal,v.priced=stableRaw(r.Amount2,r.Decimals2)
 }
 return v,true
}
func floatPtr(v float64)*float64{return &v}
func intPtr(v int)*int{return &v}
func indexSolscan(mint,tf string,from,to,observedThrough int64,complete bool,rows []solscanActivity)volumeIndex{
 step:=int64(3600)
 switch tf{case "15m":step=900;case "4H":step=14400;case "1D":step=86400}
 var snap=volumeIndex{Schema:"senda.volume.solscan.v1",Mint:mint,Source:"Solscan Pro token DeFi swaps",
  Unit:"USDC notional (~USD)",Basis:"direct/aggregate token↔USDC router only",
  Direction:"inferred from Solscan router token1→token2",Interval:tf,From:from,To:to,
  ObservedAt:time.Now().UTC().Format(time.RFC3339),Complete:complete,Coverage:"sampled-most-recent-only",
  Bars:[]volumeBar{}}
 if complete{snap.Coverage="full-pages-in-window"}
 grouped:=map[string]indexedSwap{}
 for _,row:=range rows{
  v,ok:=parseSwap(row,mint,from,to);if !ok{continue}
  old,exists:=grouped[v.signature]
  if !exists||(v.kind=="ACTIVITY_AGG_TOKEN_SWAP"&&old.kind!="ACTIVITY_AGG_TOKEN_SWAP")||
    (v.priced&&!old.priced&&v.kind==old.kind){grouped[v.signature]=v}
 }
 type cell struct{buy,sell float64;trades int}
 buckets:=map[int64]cell{}
 for _,v:=range grouped{
  if !v.priced||v.nominal<=0{snap.UnpricedSwaps++;continue}
  snap.PricedSwaps++
  key:=(v.epoch/step)*step
  x:=buckets[key]
  if v.side=="buy"{x.buy+=v.nominal}else{x.sell+=v.nominal}
  x.trades++;buckets[key]=x
 }
 snap.TotalSwapsObserved=len(grouped)
 for t:=(from/step)*step;t<to;t+=step{
  x,ok:=buckets[t]
  cellBar:=volumeBar{T:t*1000}
  if ok{
   buy,sell:=x.buy,x.sell
   total,net:=buy+sell,buy-sell
   cellBar.BuyUsd=floatPtr(buy);cellBar.SellUsd=floatPtr(sell)
   cellBar.TotalUsd=floatPtr(total);cellBar.NetUsd=floatPtr(net)
   cellBar.Trades=intPtr(x.trades);cellBar.Observed=true
   snap.BuyUsd+=buy;snap.SellUsd+=sell
  }else if complete&&t+step<=observedThrough{
   cellBar.BuyUsd=floatPtr(0);cellBar.SellUsd=floatPtr(0)
   cellBar.TotalUsd=floatPtr(0);cellBar.NetUsd=floatPtr(0)
   cellBar.Trades=intPtr(0)
  }
  snap.Bars=append(snap.Bars,cellBar)
 }
 snap.ObservedUsd=snap.BuyUsd+snap.SellUsd
 if complete{snap.Note="Indexed swaps in the requested time range; Solscan ingestion lag is possible. Direct USDC pairs only."}else{
  snap.Note="Partial indexed swap sample (pagination cap). Totals are lower-bound observations, and absent bars are unknown."
 }
 return snap
}
func tfSeconds(tf string)(int64,bool){
 switch tf{case "15m":return 900,true;case "1H":return 3600,true;case "4H":return 14400,true;case "1D":return 86400,true}
 return 0,false
}
func (s *Server) getSolscanPage(ctx context.Context,mint string,from,to int64,page int)([]solscanActivity,error){
 q:=url.Values{"address":{mint},"from_time":{strconv.FormatInt(from,10)},
  "to_time":{strconv.FormatInt(to,10)},"page":{strconv.Itoa(page)},
  "page_size":{strconv.Itoa(solscanPageSize)},"sort_by":{"block_time"},"sort_order":{"desc"}}
 q.Add("activity_type[]","ACTIVITY_TOKEN_SWAP")
 q.Add("activity_type[]","ACTIVITY_AGG_TOKEN_SWAP")
 req,e:=http.NewRequestWithContext(ctx,"GET",solscanEndpoint+"?"+q.Encode(),nil)
 if e!=nil{return nil,e}
 req.Header.Set("accept","application/json")
 req.Header.Set("token",s.solscanKey)
 resp,e:=s.client.Do(req);if e!=nil{return nil,e}
 defer resp.Body.Close()
 if resp.StatusCode!=200{return nil,fmt.Errorf("Solscan upstream HTTP %d",resp.StatusCode)}
 dec:=json.NewDecoder(io.LimitReader(resp.Body,3<<20));dec.UseNumber()
 var payload solscanResponse
 if e=dec.Decode(&payload);e!=nil{return nil,errors.New("invalid Solscan index response")}
 if !payload.Success||payload.Data==nil{return nil,errors.New("Solscan did not verify the response page")}
 return payload.Data,nil
}
func (s *Server) volume(w http.ResponseWriter,r *http.Request){
 if !s.authorized(w,r){return}
 if r.Method!="GET"{writeJSON(w,405,map[string]string{"error":"GET only"});return}
 mint:=r.URL.Query().Get("mint")
 step,ok:=tfSeconds(r.URL.Query().Get("tf"))
 if !mintPattern.MatchString(mint)||mint==usdc||!ok{writeJSON(w,400,map[string]string{"error":"Valid token and timeframe required"});return}
 if s.solscanKey==""{writeJSON(w,503,map[string]string{"error":"Server Solscan Pro API token not configured"});return}
 select{case s.slots<-struct{}{}:defer func(){<-s.slots}();case <-r.Context().Done():return}
 ctx,cancel:=context.WithTimeout(r.Context(),20*time.Second);defer cancel()
 now:=time.Now().Unix()
 end:=((now/step)+1)*step
 lookback:=step*48
 if lookback>86400{lookback=86400}
 start:=end-lookback
 var events []solscanActivity
 completed:=false
 for page:=1;page<=solscanPageCap;page++{
  data,e:=s.getSolscanPage(ctx,mint,start,now,page)
  if e!=nil{writeJSON(w,503,map[string]string{"error":"Solscan index unavailable: "+e.Error()});return}
  events=append(events,data...)
  if len(data)<solscanPageSize{completed=true;break}
 }
 writeJSON(w,200,map[string]any{"state":"ready","snapshot":indexSolscan(mint,r.URL.Query().Get("tf"),start,end,now,completed,events),
  "pages":min(solscanPageCap,(len(events)+solscanPageSize-1)/solscanPageSize),
  "reason":"Go-indexed Solscan receipts; not exchange depth, and no keys or orders are held."})
}
