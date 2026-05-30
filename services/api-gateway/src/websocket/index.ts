import { WebSocketServer, WebSocket } from 'ws';
import { createLogger } from '@netbench/logger';

const logger = createLogger('ws-manager');

interface ClientConnection {
  ws: WebSocket;
  userId?: string;
  subscriptions: Set<string>;
  connectedAt: Date;
}

export class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Map<string, ClientConnection> = new Map();
  private heartbeatInterval: NodeJS.Timeout;

  constructor(wss: WebSocketServer) {
    this.wss = wss;
    this.heartbeatInterval = setInterval(() => this.performHeartbeat(), 30000);
  }

  handleConnection(ws: WebSocket): void {
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const client: ClientConnection = {
      ws,
      subscriptions: new Set(),
      connectedAt: new Date(),
    };

    this.clients.set(clientId, client);
    logger.info(`Client connected: ${clientId}`, { totalClients: this.clients.size });

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(clientId, message);
      } catch (error) {
        logger.warn('Invalid message received', { clientId, error: (error as Error).message });
      }
    });

    ws.on('close', () => {
      this.clients.delete(clientId);
      logger.info(`Client disconnected: ${clientId}`, { totalClients: this.clients.size });
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error', { clientId, error: error.message });
      this.clients.delete(clientId);
    });

    this.send(clientId, {
      type: 'connected',
      data: { clientId, serverTime: new Date().toISOString() },
    });
  }

  private handleMessage(clientId: string, message: { type: string; data?: unknown }): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case 'subscribe':
        if (message.data && typeof message.data === 'object') {
          const channels = (message.data as { channels?: string[] }).channels || [];
          channels.forEach(ch => client.subscriptions.add(ch));
          this.send(clientId, { type: 'subscribed', data: { channels } });
        }
        break;

      case 'unsubscribe':
        if (message.data && typeof message.data === 'object') {
          const channels = (message.data as { channels?: string[] }).channels || [];
          channels.forEach(ch => client.subscriptions.delete(ch));
          this.send(clientId, { type: 'unsubscribed', data: { channels } });
        }
        break;

      case 'auth':
        if (message.data && typeof message.data === 'object') {
          client.userId = (message.data as { userId?: string }).userId;
          this.send(clientId, { type: 'authenticated', data: { userId: client.userId } });
        }
        break;

      case 'ping':
        this.send(clientId, { type: 'pong', data: { timestamp: Date.now() } });
        break;

      default:
        logger.warn('Unknown message type', { clientId, type: message.type });
    }
  }

  send(clientId: string, message: { type: string; data?: unknown }): void {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) return;

    client.ws.send(JSON.stringify(message));
  }

  broadcast(message: { type: string; data?: unknown }, channel?: string): void {
    const payload = JSON.stringify(message);

    for (const [clientId, client] of this.clients) {
      if (client.ws.readyState !== WebSocket.OPEN) continue;

      if (channel && !client.subscriptions.has(channel)) continue;

      client.ws.send(payload);
    }
  }

  broadcastToUser(userId: string, message: { type: string; data?: unknown }): void {
    const payload = JSON.stringify(message);

    for (const [, client] of this.clients) {
      if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }

  private performHeartbeat(): void {
    for (const [clientId, client] of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.ping();
      } else {
        this.clients.delete(clientId);
      }
    }
  }

  getStats(): { totalClients: number; authenticatedClients: number; subscriptions: Record<string, number> } {
    const subscriptions: Record<string, number> = {};
    let authenticatedClients = 0;

    for (const client of this.clients.values()) {
      if (client.userId) authenticatedClients++;
      for (const sub of client.subscriptions) {
        subscriptions[sub] = (subscriptions[sub] || 0) + 1;
      }
    }

    return {
      totalClients: this.clients.size,
      authenticatedClients,
      subscriptions,
    };
  }

  close(): void {
    clearInterval(this.heartbeatInterval);
    for (const [, client] of this.clients) {
      client.ws.close(1001, 'Server shutting down');
    }
    this.clients.clear();
    this.wss.close();
  }
}
