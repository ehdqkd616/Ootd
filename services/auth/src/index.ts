import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth.routes';
import { adminRouter } from './routes/admin.routes';
import { bootstrapAdmin } from './services/auth.service';

const app = express();
const PORT = process.env.PORT ?? 3001;

// Caddy → nginx 뒤에 있으므로 사설망 프록시를 신뢰해야 req.ip가 실제 클라이언트 IP가 된다 (rate limit 키)
app.set('trust proxy', 'loopback, uniquelocal');
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(cookieParser());
app.use(express.json());

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/admin', adminRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'auth' }));

bootstrapAdmin()
  .catch((err) => console.error('Admin bootstrap failed:', err))
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`Auth service running on port ${PORT}`);
    });
  });
