import * as readline from 'readline';
import chalk from 'chalk';
import QRCode from 'qrcode';
import { generateToken } from './auth.js';
import { getLanIp, isPortInUse } from './network.js';
import { PtyProxy } from './pty.js';
import { AgentServer } from './server.js';
import { HistoryBuffer } from './history.js';

const DEFAULT_PORT = 8080;

export async function startAgent(): Promise<void> {
  const port = Number(process.env.AGENTPHONE_PORT ?? DEFAULT_PORT);

  if (await isPortInUse(port)) {
    console.error(chalk.red(`Port ${port} is already in use. Set AGENTPHONE_PORT to use another.`));
    process.exit(1);
  }

  const token = generateToken();
  const ip = getLanIp();
  const url = `ws://${ip}:${port}`;
  // QR payload encodes both the WS URL and the token so the mobile app can parse them
  const qrPayload = JSON.stringify({ url, token });

  // Print connection info
  console.log(chalk.bold('\n AgentPhone Desktop Agent'));
  console.log(chalk.dim('─'.repeat(40)));
  console.log(`${chalk.cyan('WebSocket')}  ${url}`);
  console.log(`${chalk.cyan('Token')}      ${token}`);
  console.log(chalk.dim('─'.repeat(40)));
  console.log(chalk.yellow('Scan QR code with AgentPhone mobile app:\n'));
  console.log(await QRCode.toString(qrPayload, { type: 'terminal', small: true }));
  console.log(chalk.dim('─'.repeat(40)));
  console.log(chalk.green('Starting Claude Code...\n'));

  // Set up PTY
  const cols = process.stdout.columns ?? 80;
  const rows = process.stdout.rows ?? 24;
  const ptyProxy = new PtyProxy({ cols, rows });
  const history = new HistoryBuffer();

  // Set up WebSocket server
  const server = new AgentServer(token, port);

  // PTY output → local terminal + broadcast to mobile clients + history
  ptyProxy.on('data', (data: string) => {
    process.stdout.write(data);
    history.append(data);
    server.broadcastPtyOutput(data);
  });

  // PTY exit → shut down
  ptyProxy.on('exit', (code: number) => {
    console.log(chalk.dim(`\n[agentphone] Claude Code exited with code ${code}`));
    server.close().then(() => process.exit(code));
  });

  // Mobile input → PTY stdin
  server.on('ptyInput', (data: string) => {
    ptyProxy.write(data);
  });

  // Mobile signal → PTY process
  server.on('controlSignal', (signal: string) => {
    ptyProxy.kill(signal);
  });

  // When a mobile client authenticates → send history snapshot
  server.on('clientAuthenticated', (clientId: string) => {
    console.log(chalk.dim(`[agentphone] Mobile client connected (${clientId})`));
    server.sendSnapshot(clientId, history.snapshot(), ptyProxy.cols, ptyProxy.rows);
  });

  server.on('clientDisconnected', (clientId: string) => {
    console.log(chalk.dim(`[agentphone] Mobile client disconnected (${clientId})`));
  });

  // Local keyboard → PTY stdin
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.on('data', (data: Buffer) => {
    ptyProxy.write(data.toString());
  });

  // Graceful shutdown
  process.on('SIGINT', () => ptyProxy.kill('SIGINT'));
  process.on('SIGTERM', () => {
    ptyProxy.kill('SIGTERM');
    server.close().then(() => process.exit(0));
  });
}
