export class WakeLockManager {
  private wakeLock: WakeLockSentinel | null = null;
  private isRequested: boolean = false;

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (this.isRequested && document.visibilityState === 'visible') {
          this.request();
        }
      });
    }
  }

  public async request(): Promise<boolean> {
    this.isRequested = true;
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => {
          this.wakeLock = null;
        });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  public release(): void {
    this.isRequested = false;
    if (this.wakeLock) {
      this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
    }
  }

  public isActive(): boolean {
    return this.wakeLock !== null;
  }
}

export const wakeLockManager = new WakeLockManager();
