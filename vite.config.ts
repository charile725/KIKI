import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: { output: { manualChunks: {
      react: ['react','react-dom','react-router-dom'],
      supabase: ['@supabase/supabase-js'],
      validation: ['zod'],
    } } },
  },
  server: {
    port: Number(process.env.WEB_PORT || 5173),
    strictPort: true,
    proxy: { "/api": `http://127.0.0.1:${process.env.PORT || 3001}` },
  },
});
