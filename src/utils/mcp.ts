import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { experimental_createMCPClient } from "ai";
import { McpClient, StreamableHTTPServerConfig } from "../types.js";

export async function createStreamableHTTPClient({
  url,
  headers,
}: StreamableHTTPServerConfig) {
  try {
    const parsedUrl = new URL(url);
    
    const transport = new StreamableHTTPClientTransport(parsedUrl, {
      requestInit: {
        headers,
      },
    });

    const client = await experimental_createMCPClient({
      transport,
    });

    return client;
  } catch (error) {
    console.error('Error in createStreamableHTTPClient:', error);
    throw error;
  }
}

export async function getStreamableHTTPServerTools(client: McpClient) {
  try {
    const tools = await client.tools();
    return tools;
  } catch (error) {
    console.error('Error in getStreamableHTTPServerTools:', error);
    throw error;
  }
}
