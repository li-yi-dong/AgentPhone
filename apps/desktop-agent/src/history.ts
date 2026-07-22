/**
 * In-memory ring buffer that stores the last N bytes of PTY output.
 * Used to replay terminal history to mobile clients that connect mid-session.
 *
 * NOTE: We store raw ANSI bytes. Recipients MUST reset xterm.js state
 * (\x1bc or Terminal.reset()) before replaying to avoid broken escape
 * sequences from mid-stream truncation.
 */
export class HistoryBuffer {
  private chunks: string[] = [];
  private totalSize = 0;
  private readonly maxBytes: number;

  constructor(maxBytes = 256 * 1024 /* 256 KB */) {
    this.maxBytes = maxBytes;
  }

  append(data: string): void {
    this.chunks.push(data);
    this.totalSize += data.length;

    // Evict oldest chunks when over budget
    while (this.totalSize > this.maxBytes && this.chunks.length > 0) {
      this.totalSize -= this.chunks[0]!.length;
      this.chunks.shift();
    }
  }

  /** Returns all buffered history as a single concatenated string */
  snapshot(): string {
    return this.chunks.join('');
  }

  clear(): void {
    this.chunks = [];
    this.totalSize = 0;
  }
}
