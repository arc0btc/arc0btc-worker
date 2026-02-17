import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          // Override service bindings that only exist on Cloudflare
          // The LOGS binding is optional (code checks before use)
          serviceBindings: {
            LOGS: () => new Response(null, { status: 204 }),
          },
        },
      },
    },
  },
});
