import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  createStreamableHTTPClient,
  getStreamableHTTPServerTools,
} from "../utils/mcp.js";
import { mcpServerConfigSchema, toolsResponseSchema, errorResponseSchema } from "../schemas/mcp.js";

const mcpRouter = new OpenAPIHono();

const getToolsRoute = createRoute({
  method: "post",
  path: "/tools",
  tags: ["mcp"],
  summary: "Get available MCP tools",
  description: "Retrieve the list of available tools from an MCP server",
  request: {
    body: {
      content: {
        "application/json": {
          schema: mcpServerConfigSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "List of available MCP tools",
      content: {
        "application/json": {
          schema: toolsResponseSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
  },
});

mcpRouter.openapi(getToolsRoute, async (c) => {
  const { url, headers } = c.req.valid("json");

  try {
    const client = await createStreamableHTTPClient({
      url,
      headers: headers,
    });
    const tools = await getStreamableHTTPServerTools(client);
    await client.close();

    return c.json(tools as any);
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : "An error occurred",
      },
      500
    );
  }
});

export default mcpRouter;
