import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
    build: {
        outDir: '../dist',
    },
    plugins: [react()],
    server: {
        proxy: {
            '/api': {
                changeOrigin: true,
                target: 'http://localhost:3001',
            },
        },
    },
});
