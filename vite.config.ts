// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// MeridianVest runs on its own Supabase project (owned by the site operator).
// These are public values (project URL + anon key) and intentionally committed
// so both dev and production builds target the same owned database.
const OWNED_SUPABASE_URL = "https://stismpcnqqefgdbtgtqx.supabase.co";
const OWNED_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0aXNtcGNucXFlZmdkYnRndHF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1MzI0NDgsImV4cCI6MjEwNTEwODQ0OH0.1CdlEW81Gdb7tfSFcpnUO49PYmJ16GOwkWBTPXYKVJI";
const OWNED_SUPABASE_PROJECT_ID = "stismpcnqqefgdbtgtqx";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(OWNED_SUPABASE_URL),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(OWNED_SUPABASE_ANON_KEY),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(OWNED_SUPABASE_ANON_KEY),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(OWNED_SUPABASE_PROJECT_ID),
    },
  },
});
