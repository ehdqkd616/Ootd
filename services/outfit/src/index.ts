import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { outfitRouter } from './routes/outfit.routes';
import { recommendationRouter } from './routes/recommendation.routes';
import { setupWebSocket } from './ws/job.ws';
import { requireAuth, AuthRequest } from './middleware/auth.middleware';
import { getJob } from './services/outfit.service';

const app = express();
const PORT = process.env.PORT ?? 3003;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json());

app.use('/api/v1/outfits', outfitRouter);
app.use('/api/v1/recommendations', recommendationRouter);
app.get('/api/v1/jobs/:jobId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const job = await getJob(req.params.jobId);
    res.json(job);
  } catch {
    res.status(404).json({ message: '작업을 찾을 수 없습니다.' });
  }
});
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'outfit' }));

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
setupWebSocket(wss);

httpServer.listen(PORT, () => {
  console.log(`Outfit service running on port ${PORT}`);
});

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err);
});
