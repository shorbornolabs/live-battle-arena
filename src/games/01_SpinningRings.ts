import { COLOR_GLOWS, TEAM_COLORS, WATCHDOG_MAX_ROUND_DURATION_SEC } from '../constants';
import { audioSynth } from '../core/AudioSynth';
import { ParticlePool } from '../core/ParticlePool';
import { GameLiveStats, IGameEngine, RoundWinner, TeamColor } from '../types';

interface Ring {
  radius: number;
  thickness: number;
  angle: number;
  rotSpeed: number;
  gapSize: number; // in radians
  shattered: boolean;
  shatterAlpha: number;
}

interface Ball {
  color: TeamColor;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  currentRingLevel: number; // 0 = innermost, 10 = escaped
  trail: { x: number; y: number }[];
  trailHead: number;
}

export class SpinningRingsGame implements IGameEngine {
  private width: number = 360;
  private height: number = 640;
  private centerX: number = 180;
  private centerY: number = 320;
  private rings: Ring[] = [];
  private balls: Ball[] = [];
  private pool: ParticlePool;
  private elapsedSeconds: number = 0;
  private isEnded: boolean = false;
  private totalRings: number = 10;
  private suddenDeathActive: boolean = false;

  constructor(pool: ParticlePool) {
    this.pool = pool;
  }

  public init(canvas: HTMLCanvasElement, width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.centerX = width / 2;
    this.centerY = height / 2;
    this.elapsedSeconds = 0;
    this.isEnded = false;
    this.suddenDeathActive = false;

    const maxRadius = Math.min(width, height) * 0.44;
    const minRadius = maxRadius * 0.16;
    const step = (maxRadius - minRadius) / (this.totalRings - 1);

    this.rings = [];
    for (let i = 0; i < this.totalRings; i++) {
      const radius = minRadius + i * step;
      const dir = i % 2 === 0 ? 1 : -1;
      const speed = (0.5 + (this.totalRings - i) * 0.12) * dir;
      // Gap size: 0.7 rad (~40 deg)
      const gap = 0.75 + (i * 0.02);
      this.rings.push({
        radius,
        thickness: 3.5,
        angle: (Math.PI * 2 * i) / this.totalRings + Math.random(),
        rotSpeed: speed,
        gapSize: gap,
        shattered: false,
        shatterAlpha: 1.0,
      });
    }

    const teamList: TeamColor[] = ['RED', 'CYAN', 'LIME', 'GOLD'];
    const ballRadius = Math.max(5, minRadius * 0.28);
    this.balls = teamList.map((color, index) => {
      const offsetAngle = (Math.PI * 2 * index) / teamList.length;
      const dist = minRadius * 0.4;
      const ball: Ball = {
        color,
        x: this.centerX + Math.cos(offsetAngle) * dist,
        y: this.centerY + Math.sin(offsetAngle) * dist,
        vx: (Math.random() - 0.5) * 60,
        vy: (Math.random() - 0.5) * 60,
        radius: ballRadius,
        currentRingLevel: 0,
        trail: Array.from({ length: 8 }, () => ({ x: this.centerX, y: this.centerY })),
        trailHead: 0,
      };
      return ball;
    });
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.centerX = width / 2;
    this.centerY = height / 2;
  }

  public update(dt: number): RoundWinner | null {
    if (this.isEnded) return null;
    this.elapsedSeconds += dt;

    if (this.elapsedSeconds >= 45 && !this.suddenDeathActive) {
      this.suddenDeathActive = true;
    }

    // Update rings rotation
    for (let i = 0; i < this.rings.length; i++) {
      const ring = this.rings[i];
      let speedMult = 1.0;
      if (this.suddenDeathActive) {
        speedMult = 1.35;
        // Widen gap during anti-stuck
        ring.gapSize = Math.min(1.4, ring.gapSize + dt * 0.015);
      }
      ring.angle += ring.rotSpeed * speedMult * dt;
      if (ring.shattered && ring.shatterAlpha > 0) {
        ring.shatterAlpha = Math.max(0, ring.shatterAlpha - dt * 2.5);
      }
    }

    // Physical gravity & bounce
    const gravity = 180;
    const bounceFactor = this.suddenDeathActive ? 1.08 : 0.98;

    for (let b = 0; b < this.balls.length; b++) {
      const ball = this.balls[b];

      // Gravity downwards with slight wobble
      ball.vy += gravity * dt;

      // Jitter boost after 45s to prevent orbits
      if (this.suddenDeathActive) {
        ball.vx += (Math.random() - 0.5) * 20 * dt;
      }

      // Update position
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      // Update trail
      ball.trail[ball.trailHead] = { x: ball.x, y: ball.y };
      ball.trailHead = (ball.trailHead + 1) % ball.trail.length;

      // Distance from center
      const dx = ball.x - this.centerX;
      const dy = ball.y - this.centerY;
      const dist = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);

      // Check collision against current ring barrier
      const currentLevel = ball.currentRingLevel;
      if (currentLevel < this.rings.length) {
        const ring = this.rings[currentLevel];
        const rDiff = dist - ring.radius;

        // If ball touches or passes ring boundary
        if (dist + ball.radius >= ring.radius) {
          // Normalize angle into ring's frame of reference
          let relAngle = (angle - ring.angle) % (Math.PI * 2);
          if (relAngle < 0) relAngle += Math.PI * 2;

          const inGap = relAngle <= ring.gapSize || relAngle >= (Math.PI * 2 - 0.1);

          if (inGap) {
            // Ball escaped through the gap into next outer ring!
            ball.currentRingLevel++;
            ring.shattered = true;
            this.pool.spawnBurst(
              ball.x,
              ball.y,
              TEAM_COLORS[ball.color],
              18,
              160
            );
            audioSynth.playRingShatter(ball.currentRingLevel);

            // Give a forward escape push
            ball.vx += Math.cos(angle) * 60;
            ball.vy += Math.sin(angle) * 60;

            // Check if fully escaped outer ring
            if (ball.currentRingLevel >= this.totalRings) {
              this.isEnded = true;
              return {
                winner: ball.color,
                gameId: 'spinning-rings',
                durationSeconds: Math.round(this.elapsedSeconds),
                reason: 'First ball to penetrate and escape all 10 neon rotating rings!',
                colorHex: TEAM_COLORS[ball.color],
              };
            }
          } else {
            // Elastic collision bounce off the inside of the ring
            const normalX = dx / (dist || 1);
            const normalY = dy / (dist || 1);

            // Reposition strictly inside ring
            ball.x = this.centerX + normalX * (ring.radius - ball.radius);
            ball.y = this.centerY + normalY * (ring.radius - ball.radius);

            // Reflect velocity vector
            const dot = ball.vx * normalX + ball.vy * normalY;
            if (dot > 0) {
              ball.vx = (ball.vx - 2 * dot * normalX) * bounceFactor;
              ball.vy = (ball.vy - 2 * dot * normalY) * bounceFactor;
              audioSynth.playBounce(1.0 + ball.currentRingLevel * 0.1);
              this.pool.spawn(ball.x, ball.y, TEAM_COLORS[ball.color], 3, 0.6, 2.5);
            }
          }
        }
      } else {
        // Outside outermost ring: Win!
        this.isEnded = true;
        return {
          winner: ball.color,
          gameId: 'spinning-rings',
          durationSeconds: Math.round(this.elapsedSeconds),
          reason: 'Breached the perimeter ring!',
          colorHex: TEAM_COLORS[ball.color],
        };
      }
    }

    if (this.elapsedSeconds >= WATCHDOG_MAX_ROUND_DURATION_SEC) {
      return this.forceWinner();
    }

    return null;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // Center focal neon background glow
    const grad = ctx.createRadialGradient(
      this.centerX,
      this.centerY,
      10,
      this.centerX,
      this.centerY,
      Math.min(width, height) * 0.45
    );
    grad.addColorStop(0, 'rgba(15, 23, 42, 0.8)');
    grad.addColorStop(1, 'rgba(7, 9, 15, 0.95)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Draw Rings
    for (let i = 0; i < this.rings.length; i++) {
      const ring = this.rings[i];
      const startAngle = ring.angle + ring.gapSize;
      const endAngle = ring.angle + Math.PI * 2;

      ctx.save();
      ctx.beginPath();
      ctx.arc(this.centerX, this.centerY, ring.radius, startAngle, endAngle);
      
      const neonHues = ['#00F0FF', '#FF2E63', '#39FF14', '#FFE600', '#B026FF', '#FF7700'];
      const ringColor = neonHues[i % neonHues.length];

      ctx.strokeStyle = ringColor;
      ctx.lineWidth = ring.thickness;
      ctx.shadowColor = ringColor;
      ctx.shadowBlur = ring.shattered ? 20 : 8;
      ctx.globalAlpha = ring.shattered ? ring.shatterAlpha : 0.85;
      ctx.stroke();

      // Render glowing gap edges
      const edge1X = this.centerX + Math.cos(ring.angle) * ring.radius;
      const edge1Y = this.centerY + Math.sin(ring.angle) * ring.radius;
      const edge2X = this.centerX + Math.cos(ring.angle + ring.gapSize) * ring.radius;
      const edge2Y = this.centerY + Math.sin(ring.angle + ring.gapSize) * ring.radius;

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(edge1X, edge1Y, 2.5, 0, Math.PI * 2);
      ctx.arc(edge2X, edge2Y, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // Draw Balls with glowing motion trails
    for (let b = 0; b < this.balls.length; b++) {
      const ball = this.balls[b];
      const color = TEAM_COLORS[ball.color];
      const glow = COLOR_GLOWS[ball.color];

      // Trail
      ctx.save();
      for (let t = 0; t < ball.trail.length; t++) {
        const idx = (ball.trailHead + t) % ball.trail.length;
        const pt = ball.trail[idx];
        const alpha = (t / ball.trail.length) * 0.45;
        ctx.fillStyle = color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, ball.radius * (0.4 + (t / ball.trail.length) * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Ball Body & Glow
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();

      // Core white specular highlight
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(ball.x - ball.radius * 0.3, ball.y - ball.radius * 0.3, ball.radius * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  public getLiveStats(): GameLiveStats {
    let bestLevel = -1;
    let leader: TeamColor = 'RED';

    const previews = this.balls.map((b) => {
      if (b.currentRingLevel > bestLevel) {
        bestLevel = b.currentRingLevel;
        leader = b.color;
      }
      return {
        name: b.color,
        score: `Ring ${b.currentRingLevel + 1}/${this.totalRings}`,
        color: TEAM_COLORS[b.color],
      };
    });

    return {
      gameTitle: 'Spinning Rings Escape',
      roundTimerSeconds: Math.floor(this.elapsedSeconds),
      leadingTeam: leader,
      secondaryInfo: `LEADER: ${leader} (Ring ${bestLevel + 1}/${this.totalRings})`,
      leaderboardPreview: previews,
      suddenDeathActive: this.suddenDeathActive,
      statusText: this.suddenDeathActive ? 'SUDDEN DEATH // WIDE GAPS' : 'ACTIVE CHASE',
    };
  }

  public forceWinner(): RoundWinner {
    this.isEnded = true;
    let bestBall = this.balls[0];
    for (let i = 1; i < this.balls.length; i++) {
      if (this.balls[i].currentRingLevel > bestBall.currentRingLevel) {
        bestBall = this.balls[i];
      }
    }
    return {
      winner: bestBall.color,
      gameId: 'spinning-rings',
      durationSeconds: Math.round(this.elapsedSeconds),
      reason: `Watchdog expired! Leading at Ring ${bestBall.currentRingLevel + 1}/${this.totalRings}`,
      colorHex: TEAM_COLORS[bestBall.color],
    };
  }

  public dispose(): void {
    this.rings = [];
    this.balls = [];
    this.isEnded = true;
  }
}
