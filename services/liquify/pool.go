package main

// Pool reserve-impact measurement from real Solana SPL token account balances.
// The supplied vaults are not verified as belonging to an AMM: this is explicitly
// a reserve scenario, not a live executable DEX quote or authenticated pool index.
import (
 "bytes"
 "context"
 "encoding/json"
 "errors"
 "io"
 "math/big"
 "net/http"
 "net/url"
 "os"
 "strconv"
 "time"
)

type tokenAccountInfo struct{
 Mint string `json:"mint"`
 Amount string `json:"amount"`
 OwnerProgram string `json:"ownerProgram"`
}
type reserveScenario struct{
 Schema string `json:"schema"`
 InputMint string `json:"inputMint"`
 OutputMint string `json:"outputMint"`
 InputVault string `json:"inputVault"`
 OutputVault string `json:"outputVault"`
 InputReserve string `json:"inputReserve"`
 OutputReserve string `json:"outputReserve"`
 InputAmount string `json:"inputAmount"`
 FeeBps uint64 `json:"feeBps"`
 EstimatedOut string `json:"estimatedOut"`
 NoFeeSpotOut string `json:"noFeeSpotOut"`
 ImpactBps string `json:"impactBps"`
 RpcSlot uint64 `json:"rpcSlot"`
 ObservedAt time.Time `json:"observedAt"`
 Executable bool `json:"executable"`
 PoolOwnershipVerified bool `json:"poolOwnershipVerified"`
 Caveat string `json:"caveat"`
}
func cpmmOut(x,y,amount *big.Int,feeBps uint64)(*big.Int,*big.Int,*big.Int,error){
 if x.Sign()<=0||y.Sign()<=0||amount.Sign()<=0||feeBps>=10000{return nil,nil,nil,errors.New("invalid reserves, size or fees")}
 tenThousand:=big.NewInt(10000)
 afterFee:=new(big.Int).Mul(amount,new(big.Int).SetUint64(10000-feeBps))
 denominator:=new(big.Int).Add(new(big.Int).Mul(x,tenThousand),afterFee)
 out:=new(big.Int).Quo(new(big.Int).Mul(y,afterFee),denominator)
 spot:=new(big.Int).Quo(new(big.Int).Mul(y,amount),x)
 if out.Sign()<=0||spot.Sign()<=0||out.Cmp(y)>=0{return nil,nil,nil,errors.New("dust or invalid liquidity")}
 impact:=new(big.Int).Sub(new(big.Int).Mul(spot,tenThousand),new(big.Int).Mul(out,tenThousand))
 impact.Quo(impact,spot)
 if impact.Sign()<0{impact.SetInt64(0)}
 return out,spot,impact,nil
}
func (s *Server) readVaults(ctx context.Context,a,b string)(tokenAccountInfo,tokenAccountInfo,uint64,error){
 rpc:=os.Getenv("SENDA_SOLANA_RPC_URL")
 if rpc==""{return tokenAccountInfo{},tokenAccountInfo{},0,errors.New("Solana RPC is not configured")}
 u,e:=url.Parse(rpc)
 if e!=nil||u.Scheme!="https"||u.User!=nil||u.RawQuery!=""||u.Fragment!=""||u.Hostname()==""{
  return tokenAccountInfo{},tokenAccountInfo{},0,errors.New("RPC must be an explicit HTTPS URL")
 }
 // Root config must be operator-controlled, not from client input.
 body,_:=json.Marshal(map[string]any{"jsonrpc":"2.0","id":1,"method":"getMultipleAccounts",
  "params":[]any{[]string{a,b},map[string]any{"encoding":"jsonParsed","commitment":"confirmed"}}})
 req,e:=http.NewRequestWithContext(ctx,"POST",rpc,bytes.NewReader(body))
 if e!=nil{return tokenAccountInfo{},tokenAccountInfo{},0,e}
 req.Header.Set("content-type","application/json")
 resp,e:=s.client.Do(req)
 if e!=nil{return tokenAccountInfo{},tokenAccountInfo{},0,e}
 defer resp.Body.Close()
 if resp.StatusCode!=200{return tokenAccountInfo{},tokenAccountInfo{},0,errors.New("RPC unavailable")}
 var response struct{
  Error json.RawMessage `json:"error"`
  Result struct{
   Context struct{Slot uint64 `json:"slot"`} `json:"context"`
   Value []struct{
    Owner string `json:"owner"`
    Data struct{
     Parsed struct{
      Type string `json:"type"`
      Info struct{
       Mint string `json:"mint"`
       TokenAmount struct{Amount string `json:"amount"`} `json:"tokenAmount"`
      } `json:"info"`
     } `json:"parsed"`
    } `json:"data"`
   } `json:"value"`
  } `json:"result"`
 }
 if json.NewDecoder(io.LimitReader(resp.Body,1<<20)).Decode(&response)!=nil||
  len(response.Error)>0||len(response.Result.Value)!=2{
  return tokenAccountInfo{},tokenAccountInfo{},0,errors.New("invalid RPC token response")
 }
 parse:=func(i int)(tokenAccountInfo,error){
  x:=response.Result.Value[i]
  if x.Owner!="TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"||x.Data.Parsed.Type!="account"||
   !digits.MatchString(x.Data.Parsed.Info.TokenAmount.Amount)||!mintPattern.MatchString(x.Data.Parsed.Info.Mint){
   return tokenAccountInfo{},errors.New("vault not a valid SPL token account")
  }
  return tokenAccountInfo{Mint:x.Data.Parsed.Info.Mint,Amount:x.Data.Parsed.Info.TokenAmount.Amount,OwnerProgram:x.Owner},nil
 }
 x,e:=parse(0);if e!=nil{return x,tokenAccountInfo{},0,e}
 y,e:=parse(1);if e!=nil{return x,y,0,e}
 return x,y,response.Result.Context.Slot,nil
}
func (s *Server) poolImpact(w http.ResponseWriter,r *http.Request){
 if !s.authorized(w,r){return}
 if r.Method!="GET"{writeJSON(w,405,map[string]string{"error":"GET only"});return}
 q:=r.URL.Query()
 in,out,amount:=q.Get("inputMint"),q.Get("outputMint"),q.Get("amount")
 a,b:=q.Get("inputVault"),q.Get("outputVault")
 fee,e:=strconv.ParseUint(q.Get("feeBps"),10,16)
 if !validAnyPair(in,out,amount)||!mintPattern.MatchString(a)||!mintPattern.MatchString(b)||a==b||e!=nil||fee>=10000{
  writeJSON(w,400,map[string]string{"error":"invalid pair, vault accounts, raw amount or fee"});return
 }
 ctx,cancel:=context.WithTimeout(r.Context(),7*time.Second);defer cancel()
 reserveA,reserveB,slot,e:=s.readVaults(ctx,a,b)
 if e!=nil{writeJSON(w,503,map[string]string{"error":"independent vault reserves unavailable"});return}
 if reserveA.Mint!=in||reserveB.Mint!=out{
  writeJSON(w,422,map[string]string{"error":"vault mints disagree with requested pair"});return
 }
 x,ok:=new(big.Int).SetString(reserveA.Amount,10);if !ok{writeJSON(w,503,map[string]string{"error":"invalid reserve"});return}
 y,ok:=new(big.Int).SetString(reserveB.Amount,10);if !ok{writeJSON(w,503,map[string]string{"error":"invalid reserve"});return}
 aRaw,_:=new(big.Int).SetString(amount,10)
 estimated,spot,impact,e:=cpmmOut(x,y,aRaw,fee)
 if e!=nil{writeJSON(w,422,map[string]string{"error":"insufficient pool scenario liquidity"});return}
 writeJSON(w,200,reserveScenario{
  Schema:"senda.liquify.reserve-scenario.v2",InputMint:in,OutputMint:out,InputVault:a,OutputVault:b,
  InputReserve:reserveA.Amount,OutputReserve:reserveB.Amount,InputAmount:amount,FeeBps:fee,
  EstimatedOut:estimated.String(),NoFeeSpotOut:spot.String(),ImpactBps:impact.String(),
  RpcSlot:slot,ObservedAt:time.Now().UTC(),Executable:false,PoolOwnershipVerified:false,
  Caveat:"Unverified user-supplied vault pairing; CPMM model ONLY. Not verified AMM pool reserves, fees, concentrated liquidity, price oracle, valid swap venue, or executable route.",
 })
}
