import {z} from 'zod';
import {createStreamableHTTPClient} from './utils/mcp.js';

export interface StreamableHTTPServerConfig {
    headers?: Record<string, string>;
    url: string;
}

export const streamableHTTPServerConfigSchema = z.object({
    headers: z.record(z.string(), z.string()).optional(),
    url: z.string().url(),
});

export type McpClient = Awaited<ReturnType<typeof createStreamableHTTPClient>>;
