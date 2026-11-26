import {createServer} from "node:http";
import {nodeHandler} from "../src/node-adapter.mjs";
const port=Number(process.env.PORT||8080);
if(!Number.isInteger(port)||port<1||port>65535)throw Error("Valid PORT required.");
const server=createServer((req,res)=>{void nodeHandler(req,res)});
server.listen(port,()=>{process.stdout.write("Senda Event Intelligence listening on "+port+"\n");});
process.on("SIGTERM",()=>server.close(()=>process.exit(0)));
