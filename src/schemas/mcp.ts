import { z } from '@hono/zod-openapi'

export const mcpServerConfigSchema = z.object({
  url: z.string().url().openapi({
    description: 'URL of the MCP server'
  }),
  headers: z.record(z.string()).optional().openapi({
    description: 'Optional headers to send with requests'
  })
}).openapi({
  description: 'Configuration for MCP server connection'
});

export const toolSchema = z.object({
  name: z.string().openapi({
    description: 'Name of the tool'
  }),
  description: z.string().openapi({
    description: 'Description of what the tool does'
  }),
  inputSchema: z.record(z.any()).openapi({
    description: 'JSON schema for the tool input parameters'
  })
}).openapi({
  description: 'MCP tool definition'
});

export const toolsResponseSchema = z.any().openapi({
  description: 'MCP tools response from the server'
});

export const errorResponseSchema = z.object({
  error: z.string().openapi({
    description: 'Error message'
  })
}).openapi({
  description: 'Error response'
});
