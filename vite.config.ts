import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(async ({ command, mode }) => {
  // Expose VITE_* env vars to import.meta.env.
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const define: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    define[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  const plugins = [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
      // Route TanStack Start's server entry to src/server.ts (our SSR error wrapper).
      server: { entry: "server" },
    }),
  ];

  // Nitro bundles the SSR output into a deployable server (build-time only).
  // Default preset "node-server" produces .output/server/index.mjs — runnable with
  // `node` and Dockerable for Render or any Node host. Override with NITRO_PRESET
  // for other targets (e.g. NITRO_PRESET=vercel when deploying to Vercel).
  if (command === "build") {
    const { nitro } = await import("nitro/vite");
    plugins.push(nitro({ preset: process.env.NITRO_PRESET ?? "node-server" }));
  }

  plugins.push(viteReact());

  return {
    define,
    resolve: {
      alias: { "@": `${process.cwd()}/src` },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
    },
    server: {
      host: "::",
      port: 8080,
      // Proxy API calls to the local FastAPI backend so the frontend can use
      // same-origin "/api" paths in dev (mirrors the nginx proxy in production).
      // 127.0.0.1 rather than "localhost" on purpose: localhost resolves to ::1
      // first on macOS, while uvicorn binds IPv4 only by default — so "localhost"
      // silently proxies to whatever else happens to hold IPv6 port 8000.
      // Override with VITE_API_PROXY if the backend runs elsewhere.
      proxy: {
        "/api": {
          target: process.env.VITE_API_PROXY ?? "http://127.0.0.1:8000",
          changeOrigin: true,
        },
      },
    },
    plugins,
  };
});
