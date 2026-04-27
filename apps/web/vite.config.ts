import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
    plugins: [vue()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    // Capacitor için relative path gereklidir
    base: './',
    build: {
        // Capacitor WebView uyumluluğu için
        target: 'es2020',
        sourcemap: false,
    },
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            },
        },
        allowedHosts: ['sandie-hypnoidal-satedly.ngrok-free.dev']
    },
});
