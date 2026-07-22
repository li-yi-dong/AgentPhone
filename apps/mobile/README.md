# AgentPhone Mobile App

React Native + Expo mobile application for remotely controlling Claude Code.

**Status**: Placeholder — to be implemented in Phase 1.

## Key Components (Planned)

- `screens/ConnectScreen.tsx` — QR code scanner + manual IP input
- `screens/TerminalScreen.tsx` — xterm.js WebView rendering PTY output
- `components/Terminal.tsx` — WebView wrapper for xterm.js
- `services/websocket.ts` — WebSocket client with challenge-response auth
- `store/session.ts` — Zustand store for connection state

## Development

```bash
npm run start -w apps/mobile
```
