import { createFileRoute } from "@tanstack/react-router";
import { HarnessError, MCP_TOOLS, harnessCall } from "@/lib/agent-harness.server";

function bearer(request: Request): string {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(\S+)/i);
  return match?.[1] || "";
}

type Rpc = { jsonrpc?: string; id?: unknown; method?: string; params?: Record<string, unknown> };

export const Route = createFileRoute("/api/mcp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Rpc = {};
        try {
          body = (await request.json()) as Rpc;
        } catch {
          return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Send JSON." } }, { status: 400 });
        }
        const id = body.id ?? null;
        const method = body.method || "";
        if (method === "initialize") {
          return Response.json({
            jsonrpc: "2.0",
            id,
            result: {
              protocolVersion: "2025-03-26",
              capabilities: { tools: {} },
              serverInfo: { name: "senda", version: "1" },
              instructions: "You queue. The person signs in Senda. You do not get a key. Call desk, then list_missions, then quote, then queue_trade.",
            },
          });
        }
        if (method === "notifications/initialized") {
          return new Response(null, { status: 202 });
        }
        if (method === "tools/list") {
          return Response.json({ jsonrpc: "2.0", id, result: { tools: MCP_TOOLS } });
        }
        if (method === "tools/call") {
          const name = String(body.params?.name || "");
          const args = body.params?.arguments;
          const params = args && typeof args === "object" && !Array.isArray(args) ? (args as Record<string, unknown>) : {};
          try {
            const result = await harnessCall(name, bearer(request), params);
            return Response.json({
              jsonrpc: "2.0",
              id,
              result: { content: [{ type: "text", text: JSON.stringify(result) }], isError: false },
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : "The harness did not answer.";
            const code = error instanceof HarnessError ? error.status : 500;
            return Response.json({
              jsonrpc: "2.0",
              id,
              result: { content: [{ type: "text", text: message }], isError: true },
              error: { code, message },
            });
          }
        }
        return Response.json({ jsonrpc: "2.0", id, error: { code: -32601, message: "That MCP call does not exist." } }, { status: 404 });
      },
    },
  },
});
