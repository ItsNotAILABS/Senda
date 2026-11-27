/**
 * Release smoke: execute the packaged Nitro/Vercel output, not Vite's dev server.
 * A successful vite build alone does not prove SSR can import its entrypoint.
 */
import {spawn} from "node:child_process";
import {setTimeout as delay} from "node:timers/promises";
import {randomInt} from "node:crypto";

const port=process.env.SENDA_SMOKE_PORT?Number(process.env.SENDA_SMOKE_PORT):randomInt(42000,49000);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error("Invalid smoke-test port");
const child=spawn(process.execPath,["node_modules/vite/bin/vite.js","preview",
 "--host","127.0.0.1","--port",String(port),"--strictPort"],{
 cwd:process.cwd(),
 env:{...process.env,SENDA_AGENT_TREASURY_READ_ENABLED:"false",SENDA_ACTIVITY_INDEX_ENABLED:"false"},
 stdio:["ignore","pipe","pipe"]
});
let logs="";
for(const channel of [child.stdout,child.stderr]){
 channel.on("data",b=>{logs=(logs+String(b)).slice(-6000)});
}
const url="http://127.0.0.1:"+port;
async function check(path,expectedText){
 let lastError="";
 const deadline=Date.now()+30000;
 while(Date.now()<deadline){
  if(child.exitCode!==null)throw Error("Preview process exited: "+logs.slice(-1500));
  try{
   const response=await fetch(url+path,{redirect:"manual",signal:AbortSignal.timeout(3500)});
   if(response.status>=500)throw Error(path+" returned HTTP "+response.status);
   if(response.status===200){
    const body=await response.text();
    if(expectedText&&!body.includes(expectedText))
     throw Error(path+" rendered without expected SSR content");
    return {path,status:response.status,bytes:body.length};
   }
   lastError="HTTP "+response.status;
  }catch(e){
   lastError=e instanceof Error?e.message:String(e);
   if(/returned HTTP 5|rendered without expected/.test(lastError))throw Error(lastError);
  }
  await delay(500);
 }
 throw Error("Preview never became healthy at "+path+": "+lastError+"; "+logs.slice(-1200));
}
try{
 const results=[];
 results.push(await check("/","<title>"));
 results.push(await check("/payments/activity","Every payment has a trail."));
 results.push(await check("/payments/activity","Governed money for agents"));
 console.log(JSON.stringify({status:"pass",source:"packaged-nitro-preview",results},null,2));
}catch(e){
 console.error("[senda:ssr-smoke] Failed:",e instanceof Error?e.message:e);
 process.exitCode=1;
}finally{
 child.kill("SIGTERM");
}
