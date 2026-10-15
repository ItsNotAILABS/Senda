import { createFileRoute } from "@tanstack/react-router";
import { handleAgentHttp } from "@/lib/agent-http.mjs";

function toResponse(result: { status: number; headers: Record<string, string>; body: string }) {
  return new Response(result.body, { status: result.status, headers: result.headers });
}

export const Route = createFileRoute("/api/agent")({
  server: {
    handlers: {
      GET: () => handleAgentHttp("GET").then(toResponse),
      POST: async ({ request }) => toResponse(await handleAgentHttp("POST", await request.text())),
      OPTIONS: () => handleAgentHttp("OPTIONS").then(toResponse),
    },
  },
});
