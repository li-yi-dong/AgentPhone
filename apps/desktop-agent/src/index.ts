#!/usr/bin/env node
/**
 * AgentPhone Desktop Agent
 * Entry point — starts the PTY proxy and WebSocket server.
 */
import { startAgent } from './agent.js';

startAgent().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
