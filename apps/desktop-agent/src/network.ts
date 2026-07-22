import * as os from 'os';
import * as net from 'net';

/**
 * Get the best local LAN IP address to display in the QR code.
 * Priority: Wi-Fi (en0) > Ethernet (en1) > first non-loopback IPv4.
 */
export function getLanIp(): string {
  const interfaces = os.networkInterfaces();

  // Preferred interface order on macOS
  const preferred = ['en0', 'en1', 'en2', 'eth0', 'eth1'];

  for (const iface of preferred) {
    const addrs = interfaces[iface];
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address;
    }
  }

  // Fallback: first non-loopback IPv4
  for (const addrs of Object.values(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address;
    }
  }

  return '127.0.0.1';
}

/** Check whether a TCP port is already in use */
export function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close(() => resolve(false));
    });
    server.listen(port, '0.0.0.0');
  });
}
