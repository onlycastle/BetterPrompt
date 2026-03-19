import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'mcp/server': 'mcp/server.ts',
    'hooks/post-session-handler': 'hooks/post-session-handler.ts',
    'hooks/session-start-handler': 'hooks/session-start-handler.ts',
  },
  outDir: 'dist',
  format: ['esm'],
  target: 'node18',
  platform: 'node',
  splitting: true,
  clean: true,
  sourcemap: true,
  dts: false,
  // Bundle these into output (not available via node_modules at runtime)
  noExternal: [/@betterprompt\/shared/, '@modelcontextprotocol/sdk', 'zod'],
  // Only native addon stays external — installed by SessionStart hook
  external: ['better-sqlite3'],
});
