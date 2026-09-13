import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "frontend",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      // 本地开发：先 `npm run build && wrangler pages dev dist`（默认 8788），
      // 再 `npm run dev`，前端即可同源访问 /api。
      "/api": "http://127.0.0.1:8788",
    },
  },
});
