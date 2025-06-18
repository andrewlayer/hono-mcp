import { z } from "zod";
import { createStreamableHTTPClient } from "./utils/mcp.js";

export interface StreamableHTTPServerConfig {
  url: string;
  headers?: Record<string, string>;
}

export const streamableHTTPServerConfigSchema = z.object({
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).optional(),
});

export type McpClient = Awaited<ReturnType<typeof createStreamableHTTPClient>>;
