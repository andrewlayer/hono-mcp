import {createRoute, OpenAPIHono} from '@hono/zod-openapi';
import {errorResponseSchema, mcpServerConfigSchema, toolsResponseSchema} from '../schemas/mcp.js';
import {
    createStreamableHTTPClient,
    getStreamableHTTPServerTools,
} from '../utils/mcp.js';

const mcpRouter = new OpenAPIHono();

const getToolsRoute = createRoute({
    description: 'Retrieve the list of available tools from an MCP server',
    method: 'post',
    path: '/tools',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: mcpServerConfigSchema,
                },
            },
        },
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: toolsResponseSchema,
                },
            },
            description: 'List of available MCP tools',
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
    summary: 'Get available MCP tools',
    tags: ['mcp'],
});

mcpRouter.openapi(getToolsRoute, async (c) => {
    const {headers, url} = c.req.valid('json');

    try {
        const client = await createStreamableHTTPClient({
            headers: headers,
            url,
        });
        const tools = await getStreamableHTTPServerTools(client);
        await client.close();

        return c.json(tools as any);
    } catch (error) {
        return c.json(
            {
                error: error instanceof Error ? error.message : 'An error occurred',
            },
            500,
        );
    }
});

export default mcpRouter;
