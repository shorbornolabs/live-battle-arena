import { TEAM_COLORS, WATCHDOG_MAX_ROUND_DURATION_SEC } from '../constants';
import { audioSynth } from '../core/AudioSynth';
import { ParticlePool } from '../core/ParticlePool';
import { GameLiveStats, IGameEngine, RoundWinner, TeamColor } from '../types';

const TOTAL_COURSE_HEIGHT = 4000;

interface Peg {
  x: number;
  y: number;
  radius: number;
}

interface Spinner {
  x: number;
  y: number;
  radius: number;
  angle: number;
  speed: number;
  arms: number;
}

interface Chevron {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Marble {
  team: TeamColor;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  rank: number;
  stuckTimer: number;
  finished: boolean;
}

export class MarbleRaceGame implements IGameEngine {
  private width: number = 360;
  private height: number = 640;
  private cameraY: number = 0;
  private targetCameraY: number = 0;
  private pegs: Peg[] = [];
  private spinners: Spinner[] = [];
  private chevrons: Chevron[] = [];
  private marbles: Marble[] = [];
  private pool: ParticlePool;
  private elapsedSeconds: number = 0;
  private isEnded: boolean = false;
  private finishLineY: number = TOTAL_COURSE_HEIGHT - 120;

  constructor(pool: ParticlePool) {
    this.pool = pool;
  }

  public init(canvas: HTMLCanvasElement, width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.cameraY = 0;
    this.targetCameraY = 0;
    this.elapsedSeconds = 0;
    this.isEnded = false;

    // Generate procedural course obstacles
    this.pegs = [];
    this.spinners = [];
    this.chevrons = [];

    // Pegs sections (staggered plinko rows)
    for (let y = 300; y < this.finishLineY - 200; y += 75) {
      // Alternate rows
      const rowOffset = ((y / 75) % 2) * 22;
      for (let x = 40 + rowOffset; x < width - 40; x += 44) {
        // Leave gaps for spinners occasionally
        if (y % 450 > 100 && y % 450 < 220) continue;
        this.pegs.push({
          x: x + (Math.random() - 0.5) * 6,
          y: y + (Math.random() - 0.5) * 6,
          radius: 5.5,
        });
      }
    }

    // Spinners every ~400px
    for (let y = 500; y < this.finishLineY - 300; y += 420) {
      this.spinners.push({
        x: width * 0.35 + (y % 2 === 0 ? 0 : width * 0.3),
        y,
        radius: 36,
        angle: Math.random() * Math.PI,
        speed: (y % 2 === 0 ? 1 : -1) * (2.0 + Math.random()),
        arms: (y % 3 === 0) ? 4 : 2,
      });
    }

    // Boost Chevrons
    for (let y = 700; y < this.finishLineY - 400; y += 600) {
      this.chevrons.push({
        x: width * 0.38,
        y,
        w: width * 0.24,
        h: 36,
      });
    }

    // 6 Marbles
    const teams: TeamColor[] = ['RED', 'CYAN', 'LIME', 'GOLD', 'PURPLE', 'ORANGE'];
    const marbleSpacing = width / (teams.length + 1);
    this.marbles = teams.map((team, i) => ({
      team,
      x: (i + 1) * marbleSpacing,
      y: 80 + Math.random() * 20,
      vx: (Math.random() - 0.5) * 30,
      vy: 10 + Math.random() * 30,
      radius: 9,
      rank: i + 1,
      stuckTimer: 0,
      finished: false,
    }));
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  public update(dt: number): RoundWinner | null {
    if (this.isEnded) return null;
    this.elapsedSeconds += dt;

    const gravity = 320;

    // Update Spinners
    for (let s = 0; s < this.spinners.length; s++) {
      const sp = this.spinners[s];
      sp.angle += sp.speed * dt;
    }

    // Update Marbles
    for (let i = 0; i < this.marbles.length; i++) {
      const m = this.marbles[i];
      if (m.finished) continue;

      m.vy += gravity * dt;

      // Position update
      m.x += m.vx * dt;
      m.y += m.vy * dt;

      // Air resistance
      m.vx *= 0.985;
      m.vy *= 0.995;

      // Arena walls
      if (m.x < m.radius + 12) {
        m.x = m.radius + 12;
        m.vx = Math.abs(m.vx) * 0.8 + 20;
        audioSynth.playBounce(0.8);
      } else if (m.x > this.width - m.radius - 12) {
        m.x = this.width - m.radius - 12;
        m.vx = -Math.abs(m.vx) * 0.8 - 20;
        audioSynth.playBounce(0.8);
      }

      // Plinko Pegs collisions
      for (let p = 0; p < this.pegs.length; p++) {
        const peg = this.pegs[p];
        const dx = m.x - peg.x;
        const dy = m.y - peg.y;
        const dist = Math.hypot(dx, dy);
        const minDist = m.radius + peg.radius;

        if (dist < minDist) {
          const nx = dx / (dist || 1);
          const ny = dy / (dist || 1);
          m.x = peg.x + nx * minDist;
          m.y = peg.y + ny * minDist;

          // Bounce
          const dot = m.vx * nx + m.vy * ny;
          if (dot < 0) {
            m.vx = (m.vx - 1.8 * dot * nx) + (Math.random() - 0.5) * 30;
            m.vy = (m.vy - 1.8 * dot * ny);
            this.pool.spawn(peg.x, peg.y, '#00F0FF', 3, 0.7, 2);
            audioSynth.playBounce(1.2 + (peg.y % 100) * 0.005);
          }
        }
      }

      // Spinner Bars collisions
      for (let s = 0; s < this.spinners.length; s++) {
        const sp = this.spinners[s];
        const dx = m.x - sp.x;
        const dy = m.y - sp.y;
        const dist = Math.hypot(dx, dy);

        if (dist < sp.radius + m.radius) {
          // Check collision with rotating arm lines
          for (let a = 0; a < sp.arms; a++) {
            const armAngle = sp.angle + (Math.PI * 2 * a) / sp.arms;
            const armEndX = sp.x + Math.cos(armAngle) * sp.radius;
            const armEndY = sp.y + Math.sin(armAngle) * sp.radius;

            // Distance to segment
            const segDist = distToSegment(m.x, m.y, sp.x, sp.y, armEndX, armEndY);
            if (segDist < m.radius + 3) {
              // Hit by spinner arm! Impart rotational tangential velocity
              const tangX = -Math.sin(armAngle) * sp.speed * sp.radius * 1.5;
              const tangY = Math.cos(armAngle) * sp.speed * sp.radius * 1.5;
              m.vx += tangX * 0.5;
              m.vy += Math.abs(tangY) * 0.8 + 60;
              this.pool.spawnBurst(m.x, m.y, '#FF2E63', 8, 110);
              audioSynth.playBounce(1.5);
              break;
            }
          }
        }
      }

      // Chevron Speed Boosters
      for (let c = 0; c < this.chevrons.length; c++) {
        const ch = this.chevrons[c];
        if (
          m.x >= ch.x &&
          m.x <= ch.x + ch.w &&
          m.y >= ch.y &&
          m.y <= ch.y + ch.h
        ) {
          m.vy = Math.max(m.vy, 420);
          audioSynth.playGatePass();
          this.pool.spawn(m.x, m.y, '#FFE600', 5, 1.4, 3);
        }
      }

      // Anti-stuck: speed near zero check
      const currentSpeed = Math.hypot(m.vx, m.vy);
      if (currentSpeed < 18) {
        m.stuckTimer += dt;
        if (m.stuckTimer >= 1.2) {
          // Nudge!
          m.stuckTimer = 0;
          m.vx += (Math.random() - 0.5) * 120;
          m.vy += 120;
          this.pool.spawn(m.x, m.y, '#FFFFFF', 4, 1.0, 2);
        }
      } else {
        m.stuckTimer = 0;
      }

      // Finish line check
      if (m.y >= this.finishLineY && !m.finished) {
        m.finished = true;
        this.isEnded = true;
        this.pool.spawnBurst(m.x, m.y, TEAM_COLORS[m.team], 30, 200);
        return {
          winner: m.team,
          gameId: 'marble-race',
          durationSeconds: Math.round(this.elapsedSeconds),
          reason: `1st Place Champion! Crossed the checkered neon finish line.`,
          colorHex: TEAM_COLORS[m.team],
        };
      }
    }

    // Inter-marble collision
    for (let i = 0; i < this.marbles.length; i++) {
      for (let j = i + 1; j < this.marbles.length; j++) {
        const m1 = this.marbles[i];
        const m2 = this.marbles[j];
        const dx = m2.x - m1.x;
        const dy = m2.y - m1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = m1.radius + m2.radius;

        if (dist < minDist && dist > 0) {
          const nx = dx / dist;
          const ny = dy / dist;
          // Separate
          const overlap = (minDist - dist) / 2;
          m1.x -= nx * overlap;
          m1.y -= ny * overlap;
          m2.x += nx * overlap;
          m2.y += ny * overlap;

          // Swap velocities along normal
          const kx = m1.vx - m2.vx;
          const ky = m1.vy - m2.vy;
          const p = 2 * (nx * kx + ny * ky) / 2;
          m1.vx -= p * nx;
          m1.vy -= p * ny;
          m2.vx += p * nx;
          m2.vy += p * ny;
        }
      }
    }

    // Calculate live ranks (sorted by Y position)
    const sorted = [...this.marbles].sort((a, b) => b.y - a.y);
    sorted.forEach((m, rankIdx) => {
      m.rank = rankIdx + 1;
    });

    // Smooth camera track on 1st place marble
    const leader = sorted[0];
    this.targetCameraY = Math.max(0, leader.y - this.height * 0.42);
    this.cameraY += (this.targetCameraY - this.cameraY) * Math.min(1.0, dt * 6);

    if (this.elapsedSeconds >= WATCHDOG_MAX_ROUND_DURATION_SEC) {
      return this.forceWinner();
    }

    return null;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    ctx.fillStyle = '#07090F';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    // Offset view by camera Y
    ctx.translate(0, -this.cameraY);

    // Side track borders
    ctx.strokeStyle = '#00F0FF';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#00F0FF';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(12, TOTAL_COURSE_HEIGHT);
    ctx.moveTo(width - 12, 0);
    ctx.lineTo(width - 12, TOTAL_COURSE_HEIGHT);
    ctx.stroke();

    // Chevrons
    for (let c = 0; c < this.chevrons.length; c++) {
      const ch = this.chevrons[c];
      ctx.save();
      ctx.fillStyle = 'rgba(255, 230, 0, 0.2)';
      ctx.strokeStyle = '#FFE600';
      ctx.lineWidth = 2;
      ctx.fillRect(ch.x, ch.y, ch.w, ch.h);
      ctx.strokeRect(ch.x, ch.y, ch.w, ch.h);
      ctx.fillStyle = '#FFE600';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('▼ ▼ SPEED BOOST ▼ ▼', ch.x + ch.w / 2, ch.y + ch.h / 2 + 4);
      ctx.restore();
    }

    // Pegs
    for (let p = 0; p < this.pegs.length; p++) {
      const peg = this.pegs[p];
      // Only draw if within visible viewport
      if (peg.y < this.cameraY - 20 || peg.y > this.cameraY + height + 20) continue;

      ctx.save();
      ctx.shadowColor = '#00F0FF';
      ctx.shadowBlur = 6;
      ctx.fillStyle = '#00F0FF';
      ctx.beginPath();
      ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Spinners
    for (let s = 0; s < this.spinners.length; s++) {
      const sp = this.spinners[s];
      if (sp.y < this.cameraY - 50 || sp.y > this.cameraY + height + 50) continue;

      ctx.save();
      ctx.shadowColor = '#FF2E63';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#FF2E63';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';

      for (let a = 0; a < sp.arms; a++) {
        const armAngle = sp.angle + (Math.PI * 2 * a) / sp.arms;
        ctx.beginPath();
        ctx.moveTo(sp.x, sp.y);
        ctx.lineTo(sp.x + Math.cos(armAngle) * sp.radius, sp.y + Math.sin(armAngle) * sp.radius);
        ctx.stroke();
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Finish Line
    ctx.save();
    ctx.shadowColor = '#39FF14';
    ctx.shadowBlur = 15;
    ctx.fillStyle = 'rgba(57, 255, 20, 0.25)';
    ctx.fillRect(12, this.finishLineY - 10, width - 24, 24);

    // Checkered pattern
    const checkSize = 12;
    for (let x = 12; x < width - 12; x += checkSize) {
      if ((x / checkSize) % 2 === 0) {
        ctx.fillStyle = '#39FF14';
        ctx.fillRect(x, this.finishLineY - 10, checkSize, 12);
        ctx.fillStyle = '#000000';
        ctx.fillRect(x, this.finishLineY + 2, checkSize, 12);
      } else {
        ctx.fillStyle = '#000000';
        ctx.fillRect(x, this.finishLineY - 10, checkSize, 12);
        ctx.fillStyle = '#39FF14';
        ctx.fillRect(x, this.finishLineY + 2, checkSize, 12);
      }
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏁 FINISH LINE 🏁', width / 2, this.finishLineY + 30);
    ctx.restore();

    // Marbles
    for (let i = 0; i < this.marbles.length; i++) {
      const m = this.marbles[i];
      const color = TEAM_COLORS[m.team];

      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
      ctx.fill();

      // Core highlight
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(m.x - 2, m.y - 2, 3, 0, Math.PI * 2);
      ctx.fill();

      // Floating Rank Badge
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#07090F';
      ctx.beginPath();
      ctx.arc(m.x + 12, m.y - 10, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${m.rank}`, m.x + 12, m.y - 10);

      ctx.restore();
    }

    ctx.restore(); // restore camera transform

    // On-screen vertical progress track sidebar
    ctx.save();
    const trackX = width - 8;
    const trackY = 40;
    const trackH = height - 80;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(trackX, trackY, 4, trackH);

    for (let i = 0; i < this.marbles.length; i++) {
      const m = this.marbles[i];
      const progress = Math.min(1.0, m.y / this.finishLineY);
      const dotY = trackY + progress * trackH;
      ctx.fillStyle = TEAM_COLORS[m.team];
      ctx.beginPath();
      ctx.arc(trackX + 2, dotY, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.restore();
  }

  public getLiveStats(): GameLiveStats {
    const sorted = [...this.marbles].sort((a, b) => b.y - a.y);
    const leader = sorted[0];
    const leaderPct = Math.round(Math.min(100, (leader.y / this.finishLineY) * 100));

    const previews = sorted.slice(0, 4).map((m) => ({
      name: `#${m.rank} ${m.team}`,
      score: `${Math.round((m.y / this.finishLineY) * 100)}%`,
      color: TEAM_COLORS[m.team],
    }));

    return {
      gameTitle: 'Marble Obstacle Race',
      roundTimerSeconds: Math.floor(this.elapsedSeconds),
      leadingTeam: leader.team,
      secondaryInfo: `1ST: ${leader.team} (${leaderPct}% to finish)`,
      leaderboardPreview: previews,
      suddenDeathActive: false,
      statusText: `RACE DOWN THE 4000PX TRACK // TRACKING P1`,
    };
  }

  public forceWinner(): RoundWinner {
    this.isEnded = true;
    const sorted = [...this.marbles].sort((a, b) => b.y - a.y);
    const leader = sorted[0];
    return {
      winner: leader.team,
      gameId: 'marble-race',
      durationSeconds: Math.round(this.elapsedSeconds),
      reason: `Watchdog expired! Leading at distance ${Math.round((leader.y / this.finishLineY) * 100)}%`,
      colorHex: TEAM_COLORS[leader.team],
    };
  }

  public dispose(): void {
    this.marbles = [];
    this.pegs = [];
    this.spinners = [];
    this.chevrons = [];
    this.isEnded = true;
  }
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}
