import { defineConfig } from "astro/config";
import preact from "@astrojs/preact";
import tailwindcss from "@tailwindcss/vite";

// Static output: the landing ships as HTML, only the Preact islands load JavaScript.
export default defineConfig({
  output: "static",
  // Port 3000 matches the API's default WEB_ORIGIN for CORS.
  server: { port: 3000 },
  // Landing locales (keep in sync with src/i18n/locales.ts): English unprefixed at `/`,
  // `/es/` and `/pt-br/` from src/pages/es and src/pages/pt-br. `/app` stays English.
  i18n: {
    locales: ["en", "es", "pt-br"],
    defaultLocale: "en",
    routing: { prefixDefaultLocale: false },
  },
  integrations: [preact()],
  vite: {
    plugins: [tailwindcss()],
  },
});
