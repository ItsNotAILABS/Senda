import { createFileRoute } from "@tanstack/react-router";
import { HarnessError, harnessCall } from "@/lib/agent-harness.server";

function bearer(request: Request): string {
  const header = request.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

export const Route = createFileRoute("/api/agent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { method?: string; params?: Record<string, unknown> };
        try {
          body = (await request.json()) as { method?: string; params?: Record<string, unknown> };
        } catch {
          return Response.json({ error: "Bad request." }, { status: 400 });
        }
        try {
          const result = await harnessCall(String(body.method || ""), bearer(request), body.params || {});
          return Response.json({ result });
        } catch (e) {
          const status = e instanceof HarnessError ? e.status : 502;
          return Response.json({ error: e instanceof Error ? e.message : "The harness did not answer." }, { status });
        }
      },
    },
  },
});
