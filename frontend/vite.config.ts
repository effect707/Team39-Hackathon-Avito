import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": resolve(import.meta.dirname, "src"),
            "@mocks": resolve(import.meta.dirname, "mocks"),
        },
    },
    server: {
        proxy: {
            "/api": {
                target: "http://localhost:8080",
                changeOrigin: true,
            },
        },
    },
    test: {
        environment: "jsdom",
        setupFiles: "./src/test/setup.ts",
        css: true,
    },
});
