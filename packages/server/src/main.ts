import { buildServer } from './createServer.js';

// WR-03: warn operators when the server starts with CORS wildcard in production.
// createServer.ts defaults to '*' when CORS_ORIGIN is unset — acceptable in dev but
// dangerous in production (any origin can make credentialed Socket.io connections).
// A throw is also acceptable here; the warn keeps startup non-fatal for the POC stage.
if (process.env['NODE_ENV'] === 'production' && !process.env['CORS_ORIGIN']) {
  console.warn(
    '[WARN] CORS_ORIGIN is not set in production. All origins are allowed. ' +
      'Set CORS_ORIGIN to restrict access.',
  );
}

const { httpServer } = buildServer();
const PORT = Number(process.env['PORT'] ?? 3001);
httpServer.listen(PORT, () => {
  console.log(`Counter Attack server listening on port ${PORT}`);
});
