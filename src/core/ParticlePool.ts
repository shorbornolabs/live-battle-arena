import { MAX_PARTICLES } from '../constants';
import { Particle } from '../types';

export class ParticlePool {
  private particles: Particle[];
  private nextIndex: number = 0;

  constructor(size: number = MAX_PARTICLES) {
    this.particles = new Array(size);
    for (let i = 0; i < size; i++) {
      this.particles[i] = {
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        size: 2,
        color: '#FFFFFF',
        alpha: 1,
        decay: 1,
      };
    }
  }

  public spawn(
    x: number,
    y: number,
    color: string,
    count: number = 6,
    speedMultiplier: number = 1.0,
    size: number = 3.5,
    maxLife: number = 0.5
  ) {
    const total = this.particles.length;
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.nextIndex];
      this.nextIndex = (this.nextIndex + 1) % total;

      const angle = Math.random() * Math.PI * 2;
      const speed = (20 + Math.random() * 80) * speedMultiplier;

      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.maxLife = maxLife + Math.random() * 0.2;
      p.life = p.maxLife;
      p.size = size * (0.7 + Math.random() * 0.6);
      p.color = color;
      p.alpha = 1.0;
      p.decay = 1.0 / p.maxLife;
    }
  }

  public spawnBurst(
    x: number,
    y: number,
    color: string,
    count: number = 16,
    speed: number = 120
  ) {
    this.spawn(x, y, color, count, speed / 50, 4.5, 0.7);
  }

  public update(dt: number) {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.alpha = Math.max(0, p.life / p.maxLife);
    }
  }

  public render(ctx: CanvasRenderingContext2D) {
    ctx.save();
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  public reset() {
    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].active = false;
    }
    this.nextIndex = 0;
  }
}
