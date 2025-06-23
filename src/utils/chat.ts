import {openai} from '@ai-sdk/openai';
import {
    CoreMessage,
    CoreToolMessage,
    streamText,
    StreamTextResult,
    ToolSet,
} from 'ai';
import {Context} from 'hono';
import {stream} from 'hono/streaming';
import {StreamableHTTPServerConfig} from '../types.js';
import {
    createStreamableHTTPClient,
    getStreamableHTTPServerTools,
} from './mcp.js';

// TODO: Handle timeouts and errors in the stream
// TODO: Add session management for MCP client
// TODO: Add support for selecting different models
// TODO: Add support for selecting enabled tools

export async function streamCompletion(
    messages: CoreMessage[],
    serverConfig: StreamableHTTPServerConfig,
) {
    const client = await createStreamableHTTPClient(serverConfig);
    const tools = await getStreamableHTTPServerTools(client);


    const toolsWithoutExecute = Object.fromEntries(
        Object.entries(tools).map(([name, tool]) => [
            name,
            {
                ...tool,
                execute: undefined,
            },
        ]),
    );

    return streamText({
        messages: messages,
        model: openai('gpt-4o'),
        onFinish: async () => {
            await client.close();
        },
        tools: toolsWithoutExecute,
    });
}

export async function getToolResultMessages(
    messages: CoreMessage[],
    serverConfig: StreamableHTTPServerConfig,
    approvedToolCallIds: string[],
) {
    const client = await createStreamableHTTPClient(serverConfig);
    const tools = await getStreamableHTTPServerTools(client);

    const toolCallMessages = messages.filter(
        (msg) =>
            !(typeof msg.content === 'string') &&
            msg.content.some((part) => part.type === 'tool-call'),
    );

    const toolCallParts = toolCallMessages.flatMap((msg) => {
        if (typeof msg.content !== 'string') {
            return msg.content.filter((part) => part.type === 'tool-call');
        }
        return [];
    });

    const toolResultMessages: CoreMessage[] = [];

    for (const part of toolCallParts) {
        const tool = tools[part.toolName];
        const approved = approvedToolCallIds.includes(part.toolCallId);
        const result = approved
            ? await tool.execute(part.args, {
                messages,
                toolCallId: part.toolCallId,
            })
            : {
                error: 'Tool call not approved by user',
            };
        const toolResultMessage: CoreToolMessage = {
            content: [
                {
                    result,
                    toolCallId: part.toolCallId,
                    toolName: part.toolName,
                    type: 'tool-result',
                },
            ],
            role: 'tool',
        };
        toolResultMessages.push(toolResultMessage);
    }

    await client.close();

    return toolResultMessages;
}

export async function handleStreamForwarding(
    c: Context,
    streamResultPromise: Promise<StreamTextResult<ToolSet, AsyncIterable<any>>>,
    options?: { prefixMessages: CoreMessage[] },
) {
    const streamResult = await streamResultPromise;
    const reader = streamResult.textStream.getReader();

    return stream(c, async (stream) => {
        try {
            while (true) {
                const {done, value} = await reader.read();
                if (done) {
                    break;
                }
                await stream.write(value);
            }

            const messages = [
                ...(options?.prefixMessages || []),
                ...(await streamResult.response).messages,
            ];
            await stream.write('\n\n');
            await stream.write(JSON.stringify({messages}));
        } catch (error) {
            console.error('Stream error:', error);
        } finally {
            await stream.close();
        }
    });
}
