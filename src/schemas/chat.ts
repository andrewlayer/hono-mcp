import {z} from '@hono/zod-openapi';

const messageSchema = z.object({
    content: z.any(),
    role: z.enum(['user', 'assistant', 'system', 'tool']).openapi({
        description: 'Role of the message sender',
    }),
}).openapi({
    description: 'A single chat message',
});

export const messagesSchema = z.array(messageSchema).openapi({
    description: 'Array of chat messages',
});

export const streamableHTTPConfigSchema = z.object({
    headers: z.record(z.string()).openapi({
        description: 'Headers to send with requests',
    }),
    url: z.string().url().openapi({
        description: 'URL of the MCP server',
    }),
}).openapi({
    description: 'Configuration for streamable HTTP server',
});

export const chatRequestSchema = z.object({
    messages: messagesSchema,
    serverConfig: streamableHTTPConfigSchema,
}).openapi({
    description: 'Request body for chat completion',
});

export const toolCallApprovalsRequestSchema = z.object({
    approvedToolCallIds: z.array(z.string()).openapi({
        description: 'Array of approved tool call IDs',
    }),
    messages: messagesSchema,
    serverConfig: streamableHTTPConfigSchema,
}).openapi({
    description: 'Request body for tool call approvals',
});

export const errorResponseSchema = z.object({
    error: z.string(),
}).openapi({
    description: 'Error response',
});
