export class DraftingRequestCoordinator {
  private activeRequestId: number | null = null;
  private nextRequestId = 1;
  private disposed = false;

  start(): number | null {
    if (this.disposed || this.activeRequestId !== null) return null;

    const requestId = this.nextRequestId;
    this.nextRequestId += 1;
    this.activeRequestId = requestId;
    return requestId;
  }

  isCurrent(requestId: number): boolean {
    return !this.disposed && this.activeRequestId === requestId;
  }

  finish(requestId: number): boolean {
    if (!this.isCurrent(requestId)) return false;
    this.activeRequestId = null;
    return true;
  }

  dispose(): void {
    this.disposed = true;
    this.activeRequestId = null;
  }
}
