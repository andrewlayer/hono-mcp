import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {experimental_createMCPClient} from 'ai';
import {McpClient, StreamableHTTPServerConfig} from '../types.js';

export async function createStreamableHTTPClient(
    {
        headers,
        url,
    }: StreamableHTTPServerConfig,
) {
    try {
        const parsedUrl = new URL(url);

        const transport = new StreamableHTTPClientTransport(parsedUrl, {
            requestInit: {
                headers,
            },
        });

        return await experimental_createMCPClient({
            transport,
        });
    } catch (error) {
        console.error('Error in createStreamableHTTPClient:', error);
        throw error;
    }
}

export async function getStreamableHTTPServerTools(client: McpClient) {
    try {
        return await client.tools();
    } catch (error) {
        console.error('Error in getStreamableHTTPServerTools:', error);
        throw error;
    }
}
