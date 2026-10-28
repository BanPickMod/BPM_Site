/**
 * One playback clock for the whole viewer (map, timeline, panels read the same time). Lives outside React so a 60 fps
 * tick never re-renders components; they subscribe and sample at the rate they need (see useClockTick).
 */
export class Clock {
  t = 0;
  playing = false;
  speed = 4;
  private stopAt: number | null = null;
  private last = 0;
  private raf = 0;
  private fns = new Set<() => void>();

  constructor(public duration: number) {}

  subscribe = (fn: () => void) => {
    this.fns.add(fn);
    return () => { this.fns.delete(fn); };
  };

  private emit() { this.fns.forEach((f) => f()); }

  set(t: number) {
    this.t = Math.max(0, Math.min(this.duration, t));
    this.emit();
  }

  setSpeed(s: number) { this.speed = s; this.emit(); }

  play() {
    if (this.playing) return;
    if (this.t >= this.duration - 0.5) this.t = 0;
    this.playing = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
    this.emit();
  }

  pause() {
    this.playing = false;
    this.stopAt = null;
    cancelAnimationFrame(this.raf);
    this.emit();
  }

  toggle() { if (this.playing) this.pause(); else this.play(); }

  /** Play from t0 to t1 at the given speed, then stop (a battle's "watch this" button). */
  range(t0: number, t1: number, speed: number) {
    this.speed = speed;
    this.t = Math.max(0, t0);
    this.stopAt = t1;
    this.playing = false;
    this.play();
  }

  private tick = (now: number) => {
    if (!this.playing) return;
    const dt = Math.min(0.25, (now - this.last) / 1000);   // a background tab must not jump the replay ahead
    this.last = now;
    this.t = Math.min(this.duration, this.t + dt * this.speed);
    if ((this.stopAt !== null && this.t >= this.stopAt) || this.t >= this.duration) { this.pause(); return; }
    this.emit();
    this.raf = requestAnimationFrame(this.tick);
  };

  /** Stop the tick loop. Subscribers stay, so a remount (React strict mode) can keep using the same clock. */
  dispose() {
    this.playing = false;
    this.stopAt = null;
    cancelAnimationFrame(this.raf);
  }
}
