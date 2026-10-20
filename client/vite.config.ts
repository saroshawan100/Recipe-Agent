import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  // PORT lives in the root .env, shared with the server.
  const env = loadEnv(mode, path.resolve(__dirname, ".."), "");
  const apiTarget = `http://localhost:${process.env.PORT ?? env.PORT ?? 5000}`;
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { "@": path.resolve(__dirname, "src") },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": { target: apiTarget, changeOrigin: true },
        "/generated": { target: apiTarget, changeOrigin: true },
      },
    },
  };
});
