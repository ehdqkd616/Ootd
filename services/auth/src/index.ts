import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth.routes';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(cookieParser());
app.use(express.json());

app.use('/api/v1/auth', authRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'auth' }));

app.listen(PORT, () => {
  console.log(`Auth service running on port ${PORT}`);
});
