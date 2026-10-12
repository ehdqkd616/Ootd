import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { wardrobeRouter } from './routes/wardrobe.routes';
import { avatarRouter } from './routes/avatar.routes';

const app = express();
const PORT = process.env.PORT ?? 3002;

// Caddy → nginx 뒤에 있으므로 사설망 프록시를 신뢰해야 req.ip가 실제 클라이언트 IP가 된다 (rate limit 키)
app.set('trust proxy', 'loopback, uniquelocal');
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json());

app.use('/api/v1/wardrobe', wardrobeRouter);
app.use('/api/v1/avatars', avatarRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'wardrobe' }));

app.listen(PORT, () => {
  console.log(`Wardrobe service running on port ${PORT}`);
});

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err);
});
