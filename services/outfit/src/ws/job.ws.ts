import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import type { WSEvent } from '@ootd/types';

const clients = new Map<string, Set<WebSocket>>();

export function setupWebSocket(wss: WebSocketServer) {
  wss.on('connection', (ws, req) => {
    const token = new URL(req.url!, 'http://localhost').searchParams.get('token');

    let userId: string | null = null;
    try {
      const payload = jwt.verify(token ?? '', process.env.JWT_ACCESS_SECRET!) as { userId: string };
      userId = payload.userId;
    } catch {
      ws.close(1008, 'Unauthorized');
      return;
    }

    if (!clients.has(userId)) clients.set(userId, new Set());
    clients.get(userId)!.add(ws);

    ws.on('close', () => {
      clients.get(userId!)?.delete(ws);
    });
  });
}

export function notifyUser(userId: string, event: WSEvent) {
  const userClients = clients.get(userId);
  if (!userClients) return;
  const payload = JSON.stringify(event);
  for (const ws of userClients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload);
  }
}
