import { defineConfig } from 'vite';
import plugin from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [plugin()],
    server: {
        port: 5173,
        allowedHosts: ['landlordly-superofficiously-edmundo.ngrok-free.dev'],
        proxy: {
            '/api': {
                // Backend is exposed on the Docker host at 9090 (-> container 8080).
                // Override with VITE_API_TARGET env var if you run the BE elsewhere.
                target: process.env.VITE_API_TARGET ?? 'http://localhost:9090',
                changeOrigin: true,
                secure: false,
            }
        }
    }
})