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
  // Bundle @betterprompt/shared into output (not on npm)
  noExternal: [/@betterprompt\/shared/],
  // Keep npm-published deps as external imports
  external: [
    '@modelcontextprotocol/sdk',
    'better-sqlite3',
    'zod',
  ],
});
