import "dotenv/config";
import { serve } from "@hono/node-server";
import { serveStatic } from '@hono/node-server/serve-static'

import { cors } from "hono/cors";
import chatRouter from "./routes/chat.js";
import mcpRouter from "./routes/mcp.js";
import { swaggerUI } from '@hono/swagger-ui'
import { OpenAPIHono } from "@hono/zod-openapi";

const app = new OpenAPIHono();

app.use("*", cors());

// API routes
app.route("/api/chat", chatRouter);
app.route("/api/mcp", mcpRouter);

// API documentation
app.doc('/api/doc', {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'MCP Web Client API',
  },
  servers: [
    {
      url: 'http://localhost:3001',
      description: 'Development server'
    }
  ]
})

app.get('/api/ui', swaggerUI({ url: '/api/doc' }))

// Serve static React files from dist directory
app.use('/*', serveStatic({ 
  root: './dist',
  index: 'index.html'
}))

// Fallback for React Router (SPA) - serves index.html for any unmatched routes
app.get('*', serveStatic({ 
  path: './dist/index.html' 
}))

serve(
  {
    fetch: app.fetch,
    port: 3001,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
    console.log(`API Documentation: http://localhost:${info.port}/api/ui`);
  }
);
