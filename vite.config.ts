import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: [
      "localhost",
      "127.0.0.1",
      ".ngrok.io",
      ".ngrok-free.app",
      ".ngrok.app",
    ],
  },
});
