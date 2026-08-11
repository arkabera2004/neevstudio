# Veritrace — project notes

TanStack Start (React 19 + TypeScript) app with TanStack Router, TanStack Query,
Tailwind CSS v4 and shadcn/ui. Server-rendered via Nitro (`node-server` preset).

- **Dev:** `npm run dev` (Vite dev server on port 8080)
- **Build:** `npm run build` → outputs a Node server to `.output/`
- **Run built server:** `npm start` (`node .output/server/index.mjs`, honors `PORT`)
- **Routes** live in `src/routes/` (file-based). `src/routeTree.gen.ts` is generated —
  do not edit it by hand.
- **Mock data** lives in `src/lib/mock-data.ts`. This is a frontend POC; there is no
  backend yet.
