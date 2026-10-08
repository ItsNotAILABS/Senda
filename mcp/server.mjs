#!/usr/bin/env node
/**
 * Senda MCP, stdio, Content-Length framed.
 * Start: node mcp/server.mjs
 * It quotes, reads, and describes. It cannot sign.
 */

import { TOOLS, callTool } from "./tools.mjs";

const serverInfo = { name: "senda", version: "1.0.0" };

function send(obj) {
  const body = JSON.stringify(obj);
  const head = `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n`;
  process.stdout.write(head + body);
}

function reply(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function fail(id, message) {
  send({ jsonrpc: "2.0", id, error: { code: -32000, message } });
}

async function handle(msg) {
  const { id, method, params } = msg;
  if (method === "notifications/initialized" || method === "notifications/cancelled") return;
  if (id == null) return;
  if (method === "initialize") {
    reply(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: { listChanged: false } },
      serverInfo,
      instructions: "Senda quotes and reads. The person's wallet signs. Do not invent a balance or a fill.",
    });
    return;
  }
  if (method === "tools/list") {
    reply(id, { tools: TOOLS });
    return;
  }
  if (method === "ping") {
    reply(id, {});
    return;
  }
  if (method === "tools/call") {
    const name = params?.name;
    const args = params?.arguments || {};
    try {
      const data = await callTool(name, args);
      reply(id, { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], isError: false });
    } catch (e) {
      reply(id, { content: [{ type: "text", text: e instanceof Error ? e.message : "Tool failed." }], isError: true });
    }
    return;
  }
  fail(id, `Unknown method ${method}`);
}

let buf = Buffer.alloc(0);
process.stdin.on("data", (chunk) => {
  buf = Buffer.concat([buf, chunk]);
  for (;;) {
    const sep = buf.indexOf("\r\n\r\n");
    if (sep === -1) return;
    const head = buf.slice(0, sep).toString("utf8");
    const match = /Content-Length:\s*(\d+)/i.exec(head);
    if (!match) {
      buf = buf.slice(sep + 4);
      continue;
    }
    const len = Number(match[1]);
    const start = sep + 4;
    if (buf.length < start + len) return;
    const raw = buf.slice(start, start + len).toString("utf8");
    buf = buf.slice(start + len);
    try {
      void handle(JSON.parse(raw));
    } catch (e) {
      fail(null, e instanceof Error ? e.message : "Bad message");
    }
  }
});
