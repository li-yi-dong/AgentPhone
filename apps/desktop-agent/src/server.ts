import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import {
  MessageType,
  createMessage,
  type Message,
  type MessagePayloadMap,
} from '@agentphone/protocol';
import { generateChallenge, computeHmac, secureEqual } from './auth.js';

export interface ClientSession {
  id: string;
  ws: WebSocket;
  authenticated: boolean;
  challenge: string | null;
}

/**
 * WebSocket server that accepts mobile client connections.
 * Handles challenge-response auth and relays PTY I/O.
 */
export class AgentServer extends EventEmitter {
  private wss: WebSocketServer;
  private clients = new Map<string, ClientSession>();
  private token: string;
  private clientCounter = 0;

  constructor(token: string, port: number) {
    super();
    this.token = token;

    this.wss = new WebSocketServer({ port, host: '0.0.0.0' });

    this.wss.on('connection', (ws) => this.handleConnection(ws));
    this.wss.on('error', (err) => this.emit('error', err));
  }

  private handleConnection(ws: WebSocket): void {
    const clientId = `client_${++this.clientCounter}`;
    const challenge = generateChallenge();

    const session: ClientSession = {
      id: clientId,
      ws,
      authenticated: false,
      challenge,
    };
    this.clients.set(clientId, session);

    // Immediately send challenge — auth must complete within 10 seconds
    this.send(ws, MessageType.AUTH_CHALLENGE, { challenge });

    const authTimeout = setTimeout(() => {
      if (!session.authenticated) {
        this.send(ws, MessageType.AUTH_FAIL, { reason: 'auth timeout' });
        ws.close(4001, 'auth timeout');
      }
    }, 10_000);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as Message;
        this.handleMessage(session, msg);
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on('close', () => {
      clearTimeout(authTimeout);
      this.clients.delete(clientId);
      this.emit('clientDisconnected', clientId);
    });

    ws.on('error', (err) => {
      console.error(`[ws] client ${clientId} error:`, err.message);
    });
  }

  private handleMessage(session: ClientSession, msg: Message): void {
    if (!session.authenticated) {
      // Only AUTH_RESPONSE is accepted before authentication
      if (msg.type !== MessageType.AUTH_RESPONSE) {
        this.send(session.ws, MessageType.AUTH_FAIL, { reason: 'not authenticated' });
        session.ws.close(4002, 'not authenticated');
        return;
      }

      const payload = msg.payload as MessagePayloadMap[MessageType.AUTH_RESPONSE];
      const expected = computeHmac(this.token, session.challenge!);

      if (!secureEqual(expected, payload.hmac)) {
        this.send(session.ws, MessageType.AUTH_FAIL, { reason: 'invalid credentials' });
        session.ws.close(4003, 'invalid credentials');
        return;
      }

      session.authenticated = true;
      session.challenge = null;
      this.send(session.ws, MessageType.AUTH_OK, {});
      this.emit('clientAuthenticated', session.id);
      return;
    }

    switch (msg.type) {
      case MessageType.PTY_INPUT:
        this.emit('ptyInput', (msg.payload as MessagePayloadMap[MessageType.PTY_INPUT]).data);
        break;

      case MessageType.MOBILE_VIEWPORT:
        // Mobile viewport is acknowledged but does NOT affect PTY size
        break;

      case MessageType.CONTROL_SIGNAL:
        this.emit(
          'controlSignal',
          (msg.payload as MessagePayloadMap[MessageType.CONTROL_SIGNAL]).signal,
        );
        break;

      case MessageType.PING:
        this.send(session.ws, MessageType.PONG, {});
        break;

      default:
        break;
    }
  }

  /** Broadcast PTY output to all authenticated clients */
  broadcastPtyOutput(data: string): void {
    const msg = JSON.stringify(createMessage(MessageType.PTY_OUTPUT, { data }));
    for (const session of this.clients.values()) {
      if (session.authenticated && session.ws.readyState === WebSocket.OPEN) {
        session.ws.send(msg);
      }
    }
  }

  /** Send terminal history snapshot to a specific client */
  sendSnapshot(clientId: string, history: string, cols: number, rows: number): void {
    const session = this.clients.get(clientId);
    if (!session || !session.authenticated) return;
    const msg = JSON.stringify(
      createMessage(MessageType.STATE_SNAPSHOT, { history, cols, rows }),
    );
    if (session.ws.readyState === WebSocket.OPEN) {
      session.ws.send(msg);
    }
  }

  private send<T extends MessageType>(
    ws: WebSocket,
    type: T,
    payload: MessagePayloadMap[T],
  ): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(createMessage(type, payload)));
    }
  }

  get connectedClients(): number {
    return [...this.clients.values()].filter((s) => s.authenticated).length;
  }

  close(): Promise<void> {
    return new Promise((resolve) => this.wss.close(() => resolve()));
  }
}
