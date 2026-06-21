import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { wardrobeRouter } from './routes/wardrobe.routes';
import { avatarRouter } from './routes/avatar.routes';

const app = express();
const PORT = process.env.PORT ?? 3002;

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
