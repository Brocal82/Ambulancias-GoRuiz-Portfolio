import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  server: {
    proxy: {
      "/api": "http://localhost:5000",
      "/uploads": "http://localhost:5000",
    },
  },
});
