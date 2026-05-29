import { buildServer } from './createServer.js';

const { httpServer } = buildServer();
const PORT = Number(process.env['PORT'] ?? 3001);
httpServer.listen(PORT, () => {
  console.log(`Counter Attack server listening on port ${PORT}`);
});
