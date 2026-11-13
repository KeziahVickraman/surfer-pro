import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import planWindowsHandler from './api/plan-windows.ts';
import writeMessagesHandler from './api/write-messages.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.DEFAULT_APP_PORT
  ? Number(process.env.DEFAULT_APP_PORT)
  : process.env.NGINX_PORT && process.env.PORT === process.env.NGINX_PORT
  ? 3000
  : Number(process.env.PORT) || 3000;

async function createServer() {
  const app = express();
  app.use(express.json());

  app.post('/api/plan-windows', async (req, res) => {
    await planWindowsHandler(req, res);
  });

  app.post('/api/write-messages', async (req, res) => {
    await writeMessagesHandler(req, res);
  });

  app.all('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API route not found.' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Launch Window server listening on http://localhost:${PORT}`);
  });
}

createServer();
