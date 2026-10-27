import { createFileRoute } from "@tanstack/react-router";
import { HarnessError, MCP_TOOLS, harnessCall } from "@/lib/agent-harness.server";

function bearer(request: Request): string {
  const header = request.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

const NAMES: Record<string, string> = {
  list_names: "list_names",
  list_strategies: "list_strategies",
  add_strategy: "add_strategy",
  open_mission: "open_mission",
  quote: "quote",
  queue_trade: "queue_trade",
  list_missions: "list_missions",
  list_intents: "list_intents",
  discover: "discover",
  short_book: "short_book",
  track: "track",
  untrack: "untrack",
  list_trackers: "list_trackers",
  list_launches: "list_launches",
  check_coin: "check_coin",
  queue_launch: "queue_launch",
  wake_limits: "wake_limits",
  market_matrix: "market_matrix",
  queue_matrix: "queue_matrix",
};

export const Route = createFileRoute("/api/mcp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { jsonrpc?: string; id?: unknown; method?: string; params?: { name?: string; arguments?: Record<string, unknown> } };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Bad request." } }, { status: 400 });
        }
        const id = body.id ?? null;
        if (body.method === "initialize") {
          return Response.json({
            jsonrpc: "2.0",
            id,
            result: { protocolVersion: "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "senda-harness", version: "1" } },
          });
        }
        if (body.method === "tools/list") {
          return Response.json({ jsonrpc: "2.0", id, result: { tools: MCP_TOOLS } });
        }
        if (body.method === "tools/call") {
          const name = NAMES[String(body.params?.name || "")];
          if (!name) return Response.json({ jsonrpc: "2.0", id, error: { code: -32602, message: "Unknown tool." } });
          try {
            const result = await harnessCall(name, bearer(request), body.params?.arguments || {});
            return Response.json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result) }], isError: false } });
          } catch (e) {
            const message = e instanceof Error ? e.message : "The harness did not answer.";
            const status = e instanceof HarnessError ? e.status : 502;
            return Response.json({ jsonrpc: "2.0", id, error: { code: status === 401 ? -32001 : -32000, message } }, { status });
          }
        }
        return Response.json({ jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found." } });
      },
    },
  },
});
