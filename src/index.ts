import 'dotenv/config';
import {serve} from '@hono/node-server';
import {serveStatic} from '@hono/node-server/serve-static';
import {swaggerUI} from '@hono/swagger-ui';
import {OpenAPIHono} from '@hono/zod-openapi';
import {cors} from 'hono/cors';
import chatRouter from './routes/chat.js';
import mcpRouter from './routes/mcp.js';

const app = new OpenAPIHono();

app.use('*', cors());

// API routes
app.route('/api/chat', chatRouter);
app.route('/api/mcp', mcpRouter);

// API documentation
app.doc('/api/doc', {
    info: {
        title: 'MCP Web Client API',
        version: '1.0.0',
    },
    openapi: '3.0.0',
    servers: [
        {
            description: 'Development server',
            url: 'http://localhost:3001',
        },
    ],
});

app.get('/api/ui', swaggerUI({url: '/api/doc'}));

// Serve static React files from dist directory
app.use('/*', serveStatic({
    index: 'index.html',
    root: './dist',
}));

// Fallback for React Router (SPA) - serves index.html for any unmatched routes
app.get('*', serveStatic({
    path: './dist/index.html',
}));

serve(
    {
        fetch: app.fetch,
        port: 3001,
    },
    (info) => {
        console.log(`Server is running on http://localhost:${info.port}`);
        console.log(`API Documentation: http://localhost:${info.port}/api/ui`);
    },
);
