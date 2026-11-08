import { defineConfig } from "astro/config";
import preact from "@astrojs/preact";
import tailwindcss from "@tailwindcss/vite";

// Static output: the landing ships as HTML, only the Preact islands load JavaScript.
export default defineConfig({
  output: "static",
  // Port 3000 matches the API's default WEB_ORIGIN for CORS.
  server: { port: 3000 },
  integrations: [preact()],
  vite: {
    plugins: [tailwindcss()],
  },
});
