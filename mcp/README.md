# Senda MCP

`node mcp/server.mjs`

Stdio. Content-Length frames. The client entry is `.mcp.json` at the repo root.

The server lists live PreStock prints, quotes Jupiter, reads a public Solana address, builds a USDC pay link, and prices a cover. It does not sign, and it does not hold a key.

```bash
node --test mcp/tools.test.mjs
```
