import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // Load .env / .env.local from the monorepo root so the same file feeds
  // both backend (pydantic-settings) and frontend (Vite). Required for
  // VITE_CLERK_PUBLISHABLE_KEY etc.
  envDir: fileURLToPath(new URL("../", import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@multiverse/shared": fileURLToPath(new URL("../shared/src/index.ts", import.meta.url)),
    },
  },
  server: { port: 5173 },
});
