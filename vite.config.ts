import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    server: {
      proxy: {
        "/chat": env.VITE_BACKEND_API_URL,
        "/tasks": env.VITE_BACKEND_API_URL,
        "/reset": env.VITE_BACKEND_API_URL,
        "/health_check": env.VITE_BACKEND_API_URL,
      },
    },
  };
});
