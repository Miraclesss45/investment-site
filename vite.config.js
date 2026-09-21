import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api/market-prices": {
        target: "https://api.coingecko.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/market-prices/, "/api/v3/simple/price"),
      },
      "/api/admin-data": {
        target: "http://localhost:5174",
        changeOrigin: true,
      },
      "/api/paper-trading-sync": {
        target: "http://localhost:5174",
        changeOrigin: true,
      },
      "/api/create-account": {
        target: "http://localhost:5174",
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/@firebase/auth"))
            return "firebase-auth";
          if (id.includes("node_modules/@firebase/firestore"))
            return "firebase-firestore";
          if (id.includes("node_modules/@firebase/app")) return "firebase-core";
          return undefined;
        },
      },
    },
  },
});
