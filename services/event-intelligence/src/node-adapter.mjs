/** Node 22 transport adapter shared by local server and Vercel function. */
import {createEventService} from "./service.mjs";
const api=createEventService();
const MAX_BODY=15000;
export async function nodeHandler(req,res){
 try{
  const origin="https://events.senda.internal";
  const url=new URL(req.url||"/",origin);
  const redirected=url.searchParams.get("__senda_path");
  if(redirected!==null&&url.pathname==="/api/index"){
   if(!/^[a-zA-Z0-9_.\/-]{1,300}$/.test(redirected)||redirected.includes("..")){
    res.statusCode=400;res.setHeader("content-type","application/json");
    res.end(JSON.stringify({error:{code:"INVALID_PATH"}}));return;
   }
   url.pathname="/v1/"+redirected.replace(/^\/+|\/+$/g,"");
   url.searchParams.delete("__senda_path");
  }
  const method=String(req.method||"GET").toUpperCase();
  let body;
  if(method==="POST"||method==="PUT"||method==="PATCH"){
   if(req.body!==undefined&&req.body!==null){
    body=typeof req.body==="string"?req.body:JSON.stringify(req.body);
   }else{
    const chunks=[];let length=0;
    for await(const chunk of req){
     length+=chunk.length;
     if(length>MAX_BODY){res.statusCode=413;res.setHeader("content-type","application/json");
      res.end(JSON.stringify({error:{code:"PAYLOAD_TOO_LARGE"}}));return}
     chunks.push(chunk);
    }
    body=Buffer.concat(chunks).toString("utf8");
   }
   if(body.length>MAX_BODY){res.statusCode=413;res.setHeader("content-type","application/json");
    res.end(JSON.stringify({error:{code:"PAYLOAD_TOO_LARGE"}}));return}
  }
  const headers=new Headers();
  if(typeof req.headers?.authorization==="string")headers.set("authorization",req.headers.authorization);
  if(typeof req.headers?.["content-type"]==="string")headers.set("content-type",req.headers["content-type"]);
  const request=new Request(url.toString(),{method,headers,body});
  const reply=await api.handleRequest(request);
  res.statusCode=reply.status;
  for(const [name,value] of reply.headers)res.setHeader(name,value);
  res.end(await reply.text());
 }catch{
  res.statusCode=500;res.setHeader("content-type","application/json; charset=utf-8");
  res.end(JSON.stringify({schema:"senda.events.error.v1",error:{code:"TRANSPORT_FAILURE",
   message:"Event API transport failed."}}));
 }
}
