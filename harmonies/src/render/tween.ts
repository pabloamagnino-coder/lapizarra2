export type Ease = (t: number) => number;

export const ease = {
  linear: (t: number) => t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outBounce: (t: number) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

interface Tween {
  elapsed: number;
  duration: number;
  update: (k: number) => void;
  ease: Ease;
  resolve: () => void;
}

/** Minimal tween runner driven by the render loop. */
export class Tweens {
  private list: Tween[] = [];

  run(duration: number, update: (k: number) => void, e: Ease = ease.inOutCubic): Promise<void> {
    return new Promise((resolve) => {
      this.list.push({ elapsed: 0, duration: Math.max(0.001, duration), update, ease: e, resolve });
    });
  }

  wait(seconds: number): Promise<void> {
    return this.run(seconds, () => {}, ease.linear);
  }

  tick(dt: number) {
    const done: Tween[] = [];
    for (const t of this.list) {
      t.elapsed += dt;
      const k = Math.min(1, t.elapsed / t.duration);
      t.update(t.ease(k));
      if (k >= 1) done.push(t);
    }
    if (done.length) {
      this.list = this.list.filter((t) => !done.includes(t));
      for (const t of done) t.resolve();
    }
  }
}
