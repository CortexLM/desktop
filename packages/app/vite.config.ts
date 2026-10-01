import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/",
  plugins: [react()],
  server: { port: 5299, strictPort: true, proxy: { "/api": "http://127.0.0.1:5298" } },
  build: { outDir: "dist", emptyOutDir: true, chunkSizeWarningLimit: 4000 },
});
