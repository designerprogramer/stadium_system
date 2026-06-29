import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/static/frontend/",   // muhiim
  server: {
    watch: {
      usePolling: true,
    },
  },
});