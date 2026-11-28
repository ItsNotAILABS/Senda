import { createFileRoute } from "@tanstack/react-router";
import { HarnessError, harnessCall } from "@/lib/agent-harness.server";

function bearer(request: Request): string {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(\S+)/i);
  return match?.[1] || "";
}

export const Route = createFileRoute("/api/agent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { method?: unknown; params?: unknown; token?: unknown } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Send JSON." }, { status: 400 });
        }
        const method = typeof body.method === "string" ? body.method : "";
        const token = bearer(request) || (typeof body.token === "string" ? body.token : "");
        const params = body.params && typeof body.params === "object" && !Array.isArray(body.params) ? (body.params as Record<string, unknown>) : {};
        try {
          const result = await harnessCall(method, token, params);
          return Response.json({ result });
        } catch (error) {
          const status = error instanceof HarnessError ? error.status : 500;
          const message = error instanceof Error ? error.message : "The harness did not answer.";
          return Response.json({ error: message }, { status });
        }
      },
    },
  },
});
