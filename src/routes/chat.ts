import {createRoute, OpenAPIHono, z} from '@hono/zod-openapi';
import {CoreMessage} from 'ai';
import {chatRequestSchema, errorResponseSchema, toolCallApprovalsRequestSchema} from '../schemas/chat.js';
import {
    getToolResultMessages,
    handleStreamForwarding,
    streamCompletion,
} from '../utils/chat.js';


const chatRouter = new OpenAPIHono();

const chatCompletionRoute = createRoute({
    description: 'Stream a chat completion response using MCP server tools',
    method: 'post',
    path: '/',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: chatRequestSchema,
                },
            },
        },
    },
    responses: {
        200: {
            content: {
                'text/event-stream': {
                    schema: z.string().openapi({
                        description: 'Server-sent events stream with chat completion data',
                    }),
                },
            },
            description: 'Streaming chat completion response',
        },
        500: {
            content: {
                'application/json': {
                    schema: errorResponseSchema,
                },
            },
            description: 'Internal server error',
        },
    },
    summary: 'Stream chat completion',
    tags: ['chat'],
});

const toolCallApprovalsRoute = createRoute({
    description: 'Execute approved tool calls and continue the chat completion stream',
    method: 'post',
    path: '/tool-call-approvals',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: toolCallApprovalsRequestSchema,
                },
            },
        },
    },
    responses: {
        200: {
            content: {
                'text/event-stream': {
                    schema: z.string().openapi({
                        description: 'Server-sent events stream with chat completion data',
                    }),
                },
            },
            description: 'Streaming chat completion response with tool results',
        },
        500: {
            content: {
                'application/json': {
                    schema: errorResponseSchema,
                },
            },
            description: 'Internal server error',
        },
    },
    summary: 'Process approved tool calls and continue chat',
    tags: ['chat'],
});

chatRouter.openapi(chatCompletionRoute, async (c) => {
    const {messages, serverConfig} = c.req.valid('json');
    c.header('Content-Type', 'text/event-stream');
    c.header('Transfer-Encoding', 'chunked');

    try {
        return await handleStreamForwarding(
            c,
            streamCompletion(messages as CoreMessage[], serverConfig),
        );
    } catch (error) {
        return c.json(
            {
                error: error instanceof Error ? error.message : 'An error occurred',
            },
            500,
        );
    }
});

chatRouter.openapi(toolCallApprovalsRoute, async (c) => {
    const {approvedToolCallIds, messages, serverConfig} = c.req.valid('json');
    c.header('Content-Type', 'text/event-stream');
    c.header('Transfer-Encoding', 'chunked');

    try {
        const toolResultMessages = await getToolResultMessages(
            messages as CoreMessage[],
            serverConfig,
            approvedToolCallIds,
        );
        return await handleStreamForwarding(
            c,
            streamCompletion([...messages as CoreMessage[], ...toolResultMessages], serverConfig),
            {prefixMessages: toolResultMessages},
        );
    } catch (error) {
        return c.json(
            {
                error: error instanceof Error ? error.message : 'An error occurred',
            },
            500,
        );
    }
});

export default chatRouter;
