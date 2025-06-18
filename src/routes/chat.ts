import {
  handleStreamForwarding,
  getToolResultMessages,
  streamCompletion,
} from "../utils/chat.js";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { chatRequestSchema, toolCallApprovalsRequestSchema, errorResponseSchema } from "../schemas/chat.js";
import { CoreMessage } from "ai";


const chatRouter = new OpenAPIHono();

const chatCompletionRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["chat"],
  summary: "Stream chat completion",
  description: "Stream a chat completion response using MCP server tools",
  request: {
    body: {
      content: {
        "application/json": {
          schema: chatRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Streaming chat completion response",
      content: {
        "text/event-stream": {
          schema: z.string().openapi({
            description: "Server-sent events stream with chat completion data"
          }),
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

const toolCallApprovalsRoute = createRoute({
  method: "post",
  path: "/tool-call-approvals",
  tags: ["chat"],
  summary: "Process approved tool calls and continue chat",
  description: "Execute approved tool calls and continue the chat completion stream",
  request: {
    body: {
      content: {
        "application/json": {
          schema: toolCallApprovalsRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Streaming chat completion response with tool results",
      content: {
        "text/event-stream": {
          schema: z.string().openapi({
            description: "Server-sent events stream with chat completion data"
          }),
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

chatRouter.openapi(chatCompletionRoute, async (c) => {
  const { messages, serverConfig } = c.req.valid("json");
  c.header("Content-Type", "text/event-stream");
  c.header("Transfer-Encoding", "chunked");

  try {
    return await handleStreamForwarding(
      c,
      streamCompletion(messages as CoreMessage[], serverConfig)
    );
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : "An error occurred",
      },
      500
    );
  }
});

chatRouter.openapi(toolCallApprovalsRoute, async (c) => {
  const { messages, serverConfig, approvedToolCallIds } = c.req.valid("json");
  c.header("Content-Type", "text/event-stream");
  c.header("Transfer-Encoding", "chunked");

  try {
    const toolResultMessages = await getToolResultMessages(
      messages as CoreMessage[],
      serverConfig,
      approvedToolCallIds
    );
    return await handleStreamForwarding(
      c,
      streamCompletion([...messages as CoreMessage[], ...toolResultMessages], serverConfig),
      { prefixMessages: toolResultMessages }
    );
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : "An error occurred",
      },
      500
    );
  }
});

export default chatRouter;
