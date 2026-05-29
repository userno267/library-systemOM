import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // allow ngrok host
    allowedHosts: ["fugitively-untruthful-madalynn.ngrok-free.dev", "unprogressively-noncognitive-karis.ngrok-free.dev","seclusion-stitch-shy.ngrok-free.dev"],
    proxy: {
        "/api": {
        target: "https://unprogressively-noncognitive-karis.ngrok-free.dev", // your backend via LocalTunnel
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
