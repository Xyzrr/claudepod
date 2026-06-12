import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // listen on the LAN so a phone on the same WiFi can connect
    allowedHosts: true, // dev-only: accept tunnel hostnames (cloudflared/ngrok)
  },
});
