# Senda MCP

`node mcp/server.mjs`

Stdio. Content-Length frames. The client entry is `.mcp.json` at the repo root.

`GET /api/agent` lists the same tools. `POST /api/agent` with `{ "name", "arguments" }` runs one. Neither path signs, and neither returns a transaction.

The server lists live PreStock prints, names the markets Jupiter or LI.FI can sign, quotes those markets, reads a public address, builds a USDC pay link, prices a cover, and reports the clearing posture.

```bash
node --test mcp/tools.test.mjs
```
