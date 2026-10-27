package main

import (
 "encoding/json"
 "net/http/httptest"
 "testing"
)
const volumeMint="77777777777777777777777777777777777777777777"
func act(sig string,t int64,typ string,buy bool,raw string)solscanActivity{
 r:=solscanRoute{Token1:usdc,Token2:volumeMint,Decimals1:6,Decimals2:9,Amount1:json.Number(raw),Amount2:json.Number("800000000")}
 if !buy{r=solscanRoute{Token1:volumeMint,Token2:usdc,Decimals1:9,Decimals2:6,Amount1:json.Number("800000000"),Amount2:json.Number(raw)}}
 return solscanActivity{Signature:sig,BlockTime:t,Type:typ,Router:r}
}
func TestNativeVolumeNoDoubleCounting(t *testing.T){
 start:=int64(1800000000)
 a:="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
 b:="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
 events:=[]solscanActivity{
  act(a,start+30,"ACTIVITY_TOKEN_SWAP",true,"15000000"),
  act(a,start+30,"ACTIVITY_AGG_TOKEN_SWAP",true,"15000000"),
  act(b,start+3605,"ACTIVITY_TOKEN_SWAP",false,"4200000"),
 }
 index:=indexSolscan(volumeMint,"1H",start,start+4*3600,start+4*3600,true,events)
 if index.PricedSwaps!=2||index.UnpricedSwaps!=0||index.ObservedUsd!=19.2{
  t.Fatalf("unexpected indexed volume %+v",index)
 }
 if len(index.Bars)!=4||index.Bars[2].TotalUsd==nil||*index.Bars[2].TotalUsd!=0{t.Fatal("complete indexed empty bar must be zero")}
}
func TestNativeVolumeUnpricedAndPartial(t *testing.T){
 start:=int64(1800000000)
 event:=act("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",start+40,"ACTIVITY_TOKEN_SWAP",true,"12000000")
 event.Router.Token1="So11111111111111111111111111111111111111112"
 index:=indexSolscan(volumeMint,"1H",start,start+2*3600,start+5400,true,[]solscanActivity{event})
 if index.PricedSwaps!=0||index.UnpricedSwaps!=1||index.ObservedUsd!=0{t.Fatalf("non stablecoin swap counted %+v",index)}
 if index.Bars[0].TotalUsd==nil||*index.Bars[0].TotalUsd!=0{t.Fatal("first completed window should be indexed as empty")}
 if index.Bars[1].TotalUsd!=nil{t.Fatal("partial live interval must remain unknown")}
}
func TestRawUSDCNeverGuessesDecimals(t *testing.T){
 if _,ok:=stableRaw(json.Number("15000000"),6);!ok{t.Fatal("valid raw amount missing")}
 for _,q:=range []struct{raw json.Number;decimals int}{
  {json.Number("15000000"),8},{json.Number("0"),6},{json.Number("1.5"),6},
  {json.Number("9007199254740992"),6},
 }{
  if n,ok:=stableRaw(q.raw,q.decimals);ok{t.Errorf("should reject raw %v / %d: %v",q.raw,q.decimals,n)}
 }
}
func TestPrivateSolscanEndpointsFailClosed(t *testing.T){
 service:=NewServer("http://127.0.0.1:1","", "private")
 req:=httptest.NewRequest("GET","/v1/volume?mint="+volumeMint+"&tf=1H",nil)
 rec:=httptest.NewRecorder();service.mux().ServeHTTP(rec,req)
 if rec.Code!=401{t.Fatalf("private volume endpoint responded %d",rec.Code)}
 req.Header.Set("X-Senda-Router-Key","private")
 rec=httptest.NewRecorder();service.mux().ServeHTTP(rec,req)
 if rec.Code!=503{t.Fatalf("missing Solscan key must not fake volume, got %d",rec.Code)}
}

func TestSolVolumeSeparateNativeNotional(t *testing.T){
 start:=int64(1800000000)
 row:=act("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",start+5,"ACTIVITY_TOKEN_SWAP",true,"2500000000")
 row.Router.Token1=wrappedSol
 row.Router.Decimals1=9
 res:=indexSolscan(volumeMint,"1H",start,start+2*3600,start+2*3600,true,[]solscanActivity{row})
 if res.SolPairedSwaps!=1||res.ObservedSol!=2.5||res.ObservedUsd!=0{
  t.Fatalf("SOL volume must remain native, got %+v",res)
 }
 if res.Bars[0].SolTotal==nil||*res.Bars[0].SolTotal!=2.5||res.Bars[0].TotalUsd==nil||*res.Bars[0].TotalUsd!=0{
  t.Fatal("must expose separately measured SOL and USDC bars")
 }
}
