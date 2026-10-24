// Simple async mutex for per-process synchronization
export class AsyncMutex {
  private locked = false
  private queue: Array<() => void> = []

  async acquire(): Promise<() => void> {
    while (this.locked) {
      await new Promise<void>((resolve) => this.queue.push(resolve))
    }
    this.locked = true
    return () => this.release()
  }

  private release(): void {
    this.locked = false
    const next = this.queue.shift()
    if (next) next()
  }
}

// Global mutex instance for sync simulation
export const syncMutex = new AsyncMutex()
