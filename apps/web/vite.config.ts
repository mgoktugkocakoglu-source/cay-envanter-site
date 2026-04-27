import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig(({ mode }) => ({
    plugins: [vue()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    // Capacitor için relative path gereklidir
    // Web deploys need absolute asset URLs so nested route refreshes work.
    // Capacitor builds still need relative paths inside the native WebView.
    base: mode === 'mobile' ? './' : '/',
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
        allowedHosts: ['cayhesabim.com']
    },
}));
