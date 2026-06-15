import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { outfitRouter } from './routes/outfit.routes';
import { setupWebSocket } from './ws/job.ws';

const app = express();
const PORT = process.env.PORT ?? 3003;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json());

app.use('/api/v1/outfits', outfitRouter);
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'outfit' }));

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
setupWebSocket(wss);

httpServer.listen(PORT, () => {
  console.log(`Outfit service running on port ${PORT}`);
});
