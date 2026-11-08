import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { env } from "./env.js";

if (env.integratorKeys.length === 0) console.warn("INTEGRATOR_API_KEYS is not set: no integrator can authenticate.");
serve({ fetch: app.fetch, port: env.port }, (i) => console.log(`KALEA API -> http://localhost:${i.port}`));
