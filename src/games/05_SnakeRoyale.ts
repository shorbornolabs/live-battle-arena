import { TEAM_COLORS, WATCHDOG_MAX_ROUND_DURATION_SEC } from '../constants';
import { audioSynth } from '../core/AudioSynth';
import { ParticlePool } from '../core/ParticlePool';
import { GameLiveStats, IGameEngine, RoundWinner, TeamColor } from '../types';

interface SnakeBodySegment {
  x: number;
  y: number;
}

interface Snake {
  team: TeamColor;
  alive: boolean;
  x: number;
  y: number;
  angle: number;
  speed: number;
  turnSpeed: number;
  segments: SnakeBodySegment[];
  length: number;
  score: number;
}

interface Orb {
  x: number;
  y: number;
  radius: number;
  color: string;
}

export class SnakeRoyaleGame implements IGameEngine {
  private width: number = 360;
  private height: number = 640;
  private snakes: Snake[] = [];
  private orbs: Orb[] = [];
  private pool: ParticlePool;
  private elapsedSeconds: number = 0;
  private isEnded: boolean = false;
  private suddenDeathActive: boolean = false;
  private safeZoneRadius: number = 300;
  private maxSafeZoneRadius: number = 300;

  constructor(pool: ParticlePool) {
    this.pool = pool;
  }

  public init(canvas: HTMLCanvasElement, width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.elapsedSeconds = 0;
    this.isEnded = false;
    this.suddenDeathActive = false;
    this.safeZoneRadius = Math.min(width, height) * 0.48;
    this.maxSafeZoneRadius = this.safeZoneRadius;

    const teams: TeamColor[] = ['RED', 'CYAN', 'LIME', 'GOLD', 'PURPLE', 'ORANGE'];
    const centerX = width / 2;
    const centerY = height / 2;
    const spawnDist = this.safeZoneRadius * 0.55;

    this.snakes = teams.map((team, i) => {
      const angle = (Math.PI * 2 * i) / teams.length;
      const x = centerX + Math.cos(angle) * spawnDist;
      const y = centerY + Math.sin(angle) * spawnDist;
      const facing = angle + Math.PI / 2;

      const segments: SnakeBodySegment[] = [];
      for (let s = 0; s < 18; s++) {
        segments.push({
          x: x - Math.cos(facing) * (s * 4),
          y: y - Math.sin(facing) * (s * 4),
        });
      }

      return {
        team,
        alive: true,
        x,
        y,
        angle: facing,
        speed: 95,
        turnSpeed: 3.2,
        segments,
        length: 22,
        score: 0,
      };
    });

    // Populate food orbs
    this.orbs = [];
    for (let i = 0; i < 35; i++) {
      this.spawnOrb();
    }
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  private spawnOrb(): void {
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const r = Math.random() * (this.safeZoneRadius * 0.85);
    const a = Math.random() * Math.PI * 2;
    const colors = ['#00F0FF', '#FF2E63', '#39FF14', '#FFE600', '#B026FF', '#FF7700'];

    this.orbs.push({
      x: centerX + Math.cos(a) * r,
      y: centerY + Math.sin(a) * r,
      radius: 3.5 + Math.random() * 2,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }

  public update(dt: number): RoundWinner | null {
    if (this.isEnded) return null;
    this.elapsedSeconds += dt;

    const centerX = this.width / 2;
    const centerY = this.height / 2;

    // Shrinking Safe Zone after 25s
    if (this.elapsedSeconds >= 25) {
      this.suddenDeathActive = true;
      const shrinkSpeed = 10; // px per second
      this.safeZoneRadius = Math.max(35, this.safeZoneRadius - shrinkSpeed * dt);
    }

    const aliveSnakes = this.snakes.filter((s) => s.alive);

    // Check Last Standing
    if (aliveSnakes.length === 1) {
      this.isEnded = true;
      const winner = aliveSnakes[0];
      return {
        winner: winner.team,
        gameId: 'snake-royale',
        durationSeconds: Math.round(this.elapsedSeconds),
        reason: `Last Snake Standing! Outlasted all rival neon predators.`,
        colorHex: TEAM_COLORS[winner.team],
      };
    } else if (aliveSnakes.length === 0) {
      return this.forceWinner();
    }

    // AI & Physics for each living snake
    for (let i = 0; i < this.snakes.length; i++) {
      const s = this.snakes[i];
      if (!s.alive) continue;

      // Multi-Ray lookahead AI steering
      const rayOffsets = [0, -0.6, 0.6, -1.2, 1.2]; // Radians
      let bestAngle = s.angle;
      let highestScore = -999999;

      // Find closest food orb
      let nearestOrb: Orb | null = null;
      let nearestOrbDist = 999999;
      for (let o = 0; o < this.orbs.length; o++) {
        const orb = this.orbs[o];
        const od = Math.hypot(orb.x - s.x, orb.y - s.y);
        if (od < nearestOrbDist) {
          nearestOrbDist = od;
          nearestOrb = orb;
        }
      }

      for (let r = 0; r < rayOffsets.length; r++) {
        const testAngle = s.angle + rayOffsets[r];
        const rayDist = 45;
        const testX = s.x + Math.cos(testAngle) * rayDist;
        const testY = s.y + Math.sin(testAngle) * rayDist;

        let score = 0;

        // Penalty for proximity to safe zone border
        const distFromCenter = Math.hypot(testX - centerX, testY - centerY);
        if (distFromCenter > this.safeZoneRadius - 15) {
          score -= 10000;
        }

        // Penalty for colliding into other snake bodies
        for (let j = 0; j < this.snakes.length; j++) {
          const other = this.snakes[j];
          if (!other.alive) continue;
          const startSeg = (i === j) ? 4 : 0;
          for (let seg = startSeg; seg < other.segments.length; seg += 2) {
            const bodyPt = other.segments[seg];
            const bd = Math.hypot(testX - bodyPt.x, testY - bodyPt.y);
            if (bd < 16) {
              score -= 20000;
            }
          }
        }

        // Reward for steering toward nearest food orb
        if (nearestOrb) {
          const desiredAngle = Math.atan2(nearestOrb.y - s.y, nearestOrb.x - s.x);
          let diff = Math.abs(normalizeAngle(testAngle - desiredAngle));
          score += (Math.PI - diff) * 20;
        }

        // Slight straight preference
        score -= Math.abs(rayOffsets[r]) * 5;

        if (score > highestScore) {
          highestScore = score;
          bestAngle = testAngle;
        }
      }

      // Smooth turn toward bestAngle
      const angleDiff = normalizeAngle(bestAngle - s.angle);
      s.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), s.turnSpeed * dt);

      // Move forward
      s.x += Math.cos(s.angle) * s.speed * dt;
      s.y += Math.sin(s.angle) * s.speed * dt;

      // Update segment history
      s.segments.unshift({ x: s.x, y: s.y });
      while (s.segments.length > s.length) {
        s.segments.pop();
      }

      // Elimination check 1: Outside Safe Zone
      const dCenter = Math.hypot(s.x - centerX, s.y - centerY);
      if (dCenter >= this.safeZoneRadius) {
        this.eliminateSnake(s);
        continue;
      }

      // Elimination check 2: Body collision with another snake
      for (let j = 0; j < this.snakes.length; j++) {
        const other = this.snakes[j];
        if (!other.alive) continue;
        const startSeg = (i === j) ? 8 : 0;
        for (let seg = startSeg; seg < other.segments.length; seg++) {
          const bodyPt = other.segments[seg];
          const dist = Math.hypot(s.x - bodyPt.x, s.y - bodyPt.y);
          if (dist < 8) {
            this.eliminateSnake(s);
            break;
          }
        }
        if (!s.alive) break;
      }

      // Eating food orbs
      for (let o = this.orbs.length - 1; o >= 0; o--) {
        const orb = this.orbs[o];
        const dist = Math.hypot(s.x - orb.x, s.y - orb.y);
        if (dist < 12) {
          s.length += 3;
          s.score += 10;
          this.pool.spawn(orb.x, orb.y, orb.color, 4, 1.0, 2);
          audioSynth.playBounce(1.6);
          this.orbs.splice(o, 1);
          this.spawnOrb();
        }
      }
    }

    if (this.elapsedSeconds >= WATCHDOG_MAX_ROUND_DURATION_SEC) {
      return this.forceWinner();
    }

    return null;
  }

  private eliminateSnake(s: Snake): void {
    s.alive = false;
    this.pool.spawnBurst(s.x, s.y, TEAM_COLORS[s.team], 24, 180);
    audioSynth.playEliminationBoom();
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    ctx.fillStyle = '#07090F';
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;

    // Safe Zone Boundary Circle (Pulsing Red Hazard)
    ctx.save();
    ctx.strokeStyle = this.suddenDeathActive ? '#FF1E56' : 'rgba(0, 240, 255, 0.5)';
    ctx.lineWidth = 3;
    ctx.shadowColor = this.suddenDeathActive ? '#FF1E56' : '#00F0FF';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(centerX, centerY, this.safeZoneRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Hazard zone exterior tint
    ctx.fillStyle = 'rgba(255, 30, 86, 0.08)';
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.arc(centerX, centerY, this.safeZoneRadius, 0, Math.PI * 2, true);
    ctx.fill();
    ctx.restore();

    // Render Food Orbs
    for (let o = 0; o < this.orbs.length; o++) {
      const orb = this.orbs[o];
      ctx.save();
      ctx.shadowColor = orb.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = orb.color;
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Render Snakes
    for (let i = 0; i < this.snakes.length; i++) {
      const s = this.snakes[i];
      if (!s.alive) continue;
      const color = TEAM_COLORS[s.team];

      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;

      // Snake Body Segments
      for (let seg = s.segments.length - 1; seg >= 0; seg--) {
        const pt = s.segments[seg];
        const segRadius = Math.max(3, 7 - (seg / s.segments.length) * 3);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.85 - (seg / s.segments.length) * 0.4;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, segRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Snake Head
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 7.5, 0, Math.PI * 2);
      ctx.fill();

      // Eyes
      const eyeOffset = 3.5;
      const eyeAngle = s.angle + Math.PI / 2;
      const leftEyeX = s.x + Math.cos(eyeAngle) * eyeOffset + Math.cos(s.angle) * 3;
      const leftEyeY = s.y + Math.sin(eyeAngle) * eyeOffset + Math.sin(s.angle) * 3;
      const rightEyeX = s.x - Math.cos(eyeAngle) * eyeOffset + Math.cos(s.angle) * 3;
      const rightEyeY = s.y - Math.sin(eyeAngle) * eyeOffset + Math.sin(s.angle) * 3;

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(leftEyeX, leftEyeY, 2, 0, Math.PI * 2);
      ctx.arc(rightEyeX, rightEyeY, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    ctx.restore();
  }

  public getLiveStats(): GameLiveStats {
    const alive = this.snakes.filter((s) => s.alive);
    const sorted = [...this.snakes].sort((a, b) => (b.alive ? 1 : 0) - (a.alive ? 1 : 0) || b.score - a.score);
    const leader = sorted[0];

    const previews = sorted.slice(0, 4).map((s) => ({
      name: `${s.team} ${s.alive ? '●' : '✕'}`,
      score: `${s.length} Segs`,
      color: TEAM_COLORS[s.team],
    }));

    return {
      gameTitle: 'Neon Snake Battle Royale',
      roundTimerSeconds: Math.floor(this.elapsedSeconds),
      leadingTeam: leader?.team || 'RED',
      secondaryInfo: `SURVIVORS: ${alive.length}/6 SNAKES`,
      leaderboardPreview: previews,
      suddenDeathActive: this.suddenDeathActive,
      statusText: this.suddenDeathActive ? 'SHRINKING HAZARD RING // COLLISION ELIMINATION' : 'HUNTING FOOD ORBS',
    };
  }

  public forceWinner(): RoundWinner {
    this.isEnded = true;
    const sorted = [...this.snakes].sort((a, b) => (b.alive ? 1 : 0) - (a.alive ? 1 : 0) || b.score - a.score);
    const leader = sorted[0] || this.snakes[0];
    return {
      winner: leader.team,
      gameId: 'snake-royale',
      durationSeconds: Math.round(this.elapsedSeconds),
      reason: `Watchdog round timer expired! Highest length survivor.`,
      colorHex: TEAM_COLORS[leader.team],
    };
  }

  public dispose(): void {
    this.snakes = [];
    this.orbs = [];
    this.isEnded = true;
  }
}

function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
