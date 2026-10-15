export function handleAgentHttp(
  method: string,
  rawBody?: string,
): Promise<{ status: number; headers: Record<string, string>; body: string }>;
