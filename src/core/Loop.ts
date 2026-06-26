/**
 * Fixed-timestep-aware game loop. Provides a clamped delta time (to avoid the
 * "spiral of death" after tab switches) and a smoothed FPS readout.
 */
export class Loop {
  private rafId = 0;
  private last = 0;
  private running = false;
  private accumFps = 0;
  private frames = 0;
  fps = 0;

  constructor(private readonly update: (dt: number, elapsed: number) => void) {}

  private elapsed = 0;

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private tick = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.tick);
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    this.elapsed += dt;

    this.accumFps += dt;
    this.frames++;
    if (this.accumFps >= 0.5) {
      this.fps = Math.round(this.frames / this.accumFps);
      this.accumFps = 0;
      this.frames = 0;
    }

    this.update(dt, this.elapsed);
  };
}
