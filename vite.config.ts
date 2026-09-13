import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const portaPadrao = 8443;
const enderecoServidor = process.env.DEV_SERVER_HOST ?? "0.0.0.0";
const portaServidor = Number(process.env.PORT) || portaPadrao;
const enderecoApi = process.env.API_SERVER_URL ?? "http://127.0.0.1:3001";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: enderecoServidor,
    port: portaServidor,
    strictPort: true,
    proxy: {
      "/api": {
        target: enderecoApi,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: enderecoServidor,
    port: portaServidor,
    strictPort: true,
  },
});
