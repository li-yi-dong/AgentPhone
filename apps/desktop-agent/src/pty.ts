import * as pty from 'node-pty';
import { EventEmitter } from 'events';

export interface PtyOptions {
  /** Initial terminal columns — must match the local terminal (SIGWINCH is authoritative) */
  cols: number;
  rows: number;
}

export interface PtyEvents {
  data: (chunk: string) => void;
  exit: (code: number) => void;
}

/**
 * Manages the Claude Code child process via a PTY.
 *
 * Design invariant: PTY size is driven exclusively by local terminal SIGWINCH.
 * Mobile clients declare a MOBILE_VIEWPORT for their own xterm.js rendering,
 * but that value NEVER reaches this class.
 */
export class PtyProxy extends EventEmitter {
  private term: pty.IPty;
  private _cols: number;
  private _rows: number;

  constructor(opts: PtyOptions) {
    super();
    this._cols = opts.cols;
    this._rows = opts.rows;

    // Spawn Claude Code inside a PTY
    this.term = pty.spawn('claude', [], {
      name: 'xterm-256color',
      cols: this._cols,
      rows: this._rows,
      cwd: process.cwd(),
      env: process.env as Record<string, string>,
    });

    // Forward PTY output to listeners (local terminal + WS broadcast)
    this.term.onData((data) => {
      this.emit('data', data);
    });

    this.term.onExit(({ exitCode }) => {
      this.emit('exit', exitCode ?? 0);
    });

    // Track local terminal resize — SIGWINCH is the sole authority
    process.stdout.on('resize', () => {
      const cols = process.stdout.columns ?? this._cols;
      const rows = process.stdout.rows ?? this._rows;
      this._cols = cols;
      this._rows = rows;
      this.term.resize(cols, rows);
    });
  }

  /** Write input from any source (local keyboard or mobile) into PTY stdin */
  write(data: string): void {
    this.term.write(data);
  }

  get cols(): number {
    return this._cols;
  }

  get rows(): number {
    return this._rows;
  }

  /** Send a signal to the Claude Code process */
  kill(signal: string = 'SIGTERM'): void {
    this.term.kill(signal);
  }
}
