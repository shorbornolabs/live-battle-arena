import { RPS_COLORS, WATCHDOG_MAX_ROUND_DURATION_SEC } from '../constants';
import { audioSynth } from '../core/AudioSynth';
import { ParticlePool } from '../core/ParticlePool';
import { GameLiveStats, IGameEngine, RoundWinner } from '../types';

type RpsType = 'ROCK' | 'PAPER' | 'SCISSORS';

const RPS_EMOJI: Record<RpsType, string> = {
  ROCK: '🪨',
  PAPER: '📄',
  SCISSORS: '✂️',
};

const RPS_PREY: Record<RpsType, RpsType> = {
  ROCK: 'SCISSORS',
  PAPER: 'ROCK',
  SCISSORS: 'PAPER',
};

const RPS_PREDATOR: Record<RpsType, RpsType> = {
  ROCK: 'PAPER',
  PAPER: 'SCISSORS',
  SCISSORS: 'ROCK',
};

interface Agent {
  type: RpsType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface Bumper {
  x: number;
  y: number;
  radius: number;
  pulse: number;
}

export class RpsArenaGame implements IGameEngine {
  private width: number = 360;
  private height: number = 640;
  private agents: Agent[] = [];
  private bumpers: Bumper[] = [];
  private pool: ParticlePool;
  private elapsedSeconds: number = 0;
  private isEnded: boolean = false;
  private suddenDeathActive: boolean = false;
  private conversionCooldown: number = 0;

  constructor(pool: ParticlePool) {
    this.pool = pool;
  }

  public init(canvas: HTMLCanvasElement, width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.elapsedSeconds = 0;
    this.isEnded = false;
    this.suddenDeathActive = false;
    this.conversionCooldown = 0;

    // 3 Bouncers
    this.bumpers = [
      { x: width * 0.3, y: height * 0.35, radius: 26, pulse: 0 },
      { x: width * 0.7, y: height * 0.45, radius: 30, pulse: 0 },
      { x: width * 0.45, y: height * 0.7, radius: 28, pulse: 0 },
    ];

    // 75 agents: 25 Rock, 25 Paper, 25 Scissors
    this.agents = [];
    const types: RpsType[] = ['ROCK', 'PAPER', 'SCISSORS'];
    const countPerType = 25;

    for (let t = 0; t < types.length; t++) {
      const type = types[t];
      for (let i = 0; i < countPerType; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 70 + Math.random() * 30;
        this.agents.push({
          type,
          x: 20 + Math.random() * (width - 40),
          y: 30 + Math.random() * (height - 60),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 9,
        });
      }
    }
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  public update(dt: number): RoundWinner | null {
    if (this.isEnded) return null;
    this.elapsedSeconds += dt;
    this.conversionCooldown -= dt;

    // Count remaining factions
    let rockCount = 0;
    let paperCount = 0;
    let scissorsCount = 0;

    for (let i = 0; i < this.agents.length; i++) {
      const t = this.agents[i].type;
      if (t === 'ROCK') rockCount++;
      else if (t === 'PAPER') paperCount++;
      else scissorsCount++;
    }

    const activeFactions = (rockCount > 0 ? 1 : 0) + (paperCount > 0 ? 1 : 0) + (scissorsCount > 0 ? 1 : 0);

    // Anti-stuck: When only 2 factions remain, boost speed 1.8x
    if (activeFactions <= 2 && !this.suddenDeathActive) {
      this.suddenDeathActive = true;
    }

    // Check winner
    if (activeFactions === 1) {
      this.isEnded = true;
      const winnerType: RpsType = rockCount > 0 ? 'ROCK' : paperCount > 0 ? 'PAPER' : 'SCISSORS';
      return {
        winner: `${RPS_EMOJI[winnerType]} ${winnerType}`,
        gameId: 'rps-arena',
        durationSeconds: Math.round(this.elapsedSeconds),
        reason: `100% Total Faction Conversion! All 75 entities assimilated into ${winnerType}.`,
        colorHex: RPS_COLORS[winnerType],
      };
    }

    const speedMult = this.suddenDeathActive ? 1.8 : 1.0;
    const maxSpeed = 120 * speedMult;

    // Update Bumpers pulse
    for (let b = 0; b < this.bumpers.length; b++) {
      const bmp = this.bumpers[b];
      if (bmp.pulse > 0) {
        bmp.pulse = Math.max(0, bmp.pulse - dt * 3);
      }
    }

    // AI Steering
    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i];
      const preyType = RPS_PREY[a.type];
      const predatorType = RPS_PREDATOR[a.type];

      let nearestPreyDist = 9999;
      let preyDirX = 0;
      let preyDirY = 0;

      let nearestPredDist = 9999;
      let predDirX = 0;
      let predDirY = 0;

      for (let j = 0; j < this.agents.length; j++) {
        if (i === j) continue;
        const other = this.agents[j];
        const dx = other.x - a.x;
        const dy = other.y - a.y;
        const distSq = dx * dx + dy * dy;

        if (other.type === preyType && distSq < nearestPreyDist) {
          nearestPreyDist = distSq;
          preyDirX = dx;
          preyDirY = dy;
        } else if (other.type === predatorType && distSq < nearestPredDist) {
          nearestPredDist = distSq;
          predDirX = dx;
          predDirY = dy;
        }
      }

      // Chase prey force
      let steerX = 0;
      let steerY = 0;

      if (nearestPreyDist < 90000) {
        const d = Math.sqrt(nearestPreyDist) || 1;
        steerX += (preyDirX / d) * 160;
        steerY += (preyDirY / d) * 160;
      }

      // Flee predator force (stronger)
      if (nearestPredDist < 30000) {
        const d = Math.sqrt(nearestPredDist) || 1;
        steerX -= (predDirX / d) * 220;
        steerY -= (predDirY / d) * 220;
      }

      // Random jitter for organic movement
      steerX += (Math.random() - 0.5) * 40;
      steerY += (Math.random() - 0.5) * 40;

      // Apply steering to velocity
      a.vx += steerX * dt;
      a.vy += steerY * dt;

      // Clamp velocity
      const curSpeed = Math.hypot(a.vx, a.vy);
      if (curSpeed > maxSpeed) {
        a.vx = (a.vx / curSpeed) * maxSpeed;
        a.vy = (a.vy / curSpeed) * maxSpeed;
      }

      // Update position
      a.x += a.vx * dt;
      a.y += a.vy * dt;

      // Walls bounce
      if (a.x < a.radius) {
        a.x = a.radius;
        a.vx = Math.abs(a.vx);
      } else if (a.x > this.width - a.radius) {
        a.x = this.width - a.radius;
        a.vx = -Math.abs(a.vx);
      }

      if (a.y < a.radius) {
        a.y = a.radius;
        a.vy = Math.abs(a.vy);
      } else if (a.y > this.height - a.radius) {
        a.y = this.height - a.radius;
        a.vy = -Math.abs(a.vy);
      }

      // Bumper obstacle collisions
      for (let b = 0; b < this.bumpers.length; b++) {
        const bmp = this.bumpers[b];
        const bdx = a.x - bmp.x;
        const bdy = a.y - bmp.y;
        const bDist = Math.hypot(bdx, bdy);
        const minDist = a.radius + bmp.radius;

        if (bDist < minDist) {
          const nx = bdx / (bDist || 1);
          const ny = bdy / (bDist || 1);
          a.x = bmp.x + nx * minDist;
          a.y = bmp.y + ny * minDist;
          a.vx = nx * maxSpeed * 1.2;
          a.vy = ny * maxSpeed * 1.2;
          bmp.pulse = 1.0;
          this.pool.spawn(a.x, a.y, '#00F0FF', 4, 1.0, 2.5);
          audioSynth.playBounce(1.4);
        }
      }
    }

    // Inter-agent collision and conversion!
    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i];
      for (let j = i + 1; j < this.agents.length; j++) {
        const b = this.agents[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distSq = dx * dx + dy * dy;
        const minDist = a.radius + b.radius;

        if (distSq < minDist * minDist) {
          // Collision!
          if (a.type !== b.type) {
            // Determine winner
            if (RPS_PREY[a.type] === b.type) {
              // A beats B -> B converts to A
              b.type = a.type;
              this.pool.spawn(b.x, b.y, RPS_COLORS[a.type], 8, 1.2, 3.5);
              if (this.conversionCooldown <= 0) {
                audioSynth.playConversionBlip();
                this.conversionCooldown = 0.08;
              }
            } else if (RPS_PREY[b.type] === a.type) {
              // B beats A -> A converts to B
              a.type = b.type;
              this.pool.spawn(a.x, a.y, RPS_COLORS[b.type], 8, 1.2, 3.5);
              if (this.conversionCooldown <= 0) {
                audioSynth.playConversionBlip();
                this.conversionCooldown = 0.08;
              }
            }
          }

          // Elastic separation nudge
          const d = Math.sqrt(distSq) || 1;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * 2;
          a.y -= ny * 2;
          b.x += nx * 2;
          b.y += ny * 2;
        }
      }
    }

    if (this.elapsedSeconds >= WATCHDOG_MAX_ROUND_DURATION_SEC) {
      return this.forceWinner();
    }

    return null;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    ctx.fillStyle = '#07090F';
    ctx.fillRect(0, 0, width, height);

    // Bumpers
    for (let b = 0; b < this.bumpers.length; b++) {
      const bmp = this.bumpers[b];
      ctx.save();
      ctx.shadowColor = '#00F0FF';
      ctx.shadowBlur = 10 + bmp.pulse * 15;
      ctx.fillStyle = `rgba(0, 240, 255, ${0.15 + bmp.pulse * 0.4})`;
      ctx.strokeStyle = '#00F0FF';
      ctx.lineWidth = 2.5;

      ctx.beginPath();
      ctx.arc(bmp.x, bmp.y, bmp.radius + bmp.pulse * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Center ring
      ctx.beginPath();
      ctx.arc(bmp.x, bmp.y, bmp.radius * 0.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Agents
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '13px sans-serif';

    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i];
      const color = RPS_COLORS[a.type];

      // Glow halo
      ctx.save();
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.radius * 1.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Emoji
      ctx.save();
      ctx.fillText(RPS_EMOJI[a.type], a.x, a.y + 1);
      ctx.restore();
    }

    ctx.restore();
  }

  public getLiveStats(): GameLiveStats {
    let rockCount = 0;
    let paperCount = 0;
    let scissorsCount = 0;

    for (let i = 0; i < this.agents.length; i++) {
      const t = this.agents[i].type;
      if (t === 'ROCK') rockCount++;
      else if (t === 'PAPER') paperCount++;
      else scissorsCount++;
    }

    const previews = [
      { name: 'Rock 🪨', score: rockCount, color: RPS_COLORS.ROCK },
      { name: 'Paper 📄', score: paperCount, color: RPS_COLORS.PAPER },
      { name: 'Scissors ✂️', score: scissorsCount, color: RPS_COLORS.SCISSORS },
    ];

    let leader = 'ROCK';
    let maxCount = rockCount;
    if (paperCount > maxCount) {
      leader = 'PAPER';
      maxCount = paperCount;
    }
    if (scissorsCount > maxCount) {
      leader = 'SCISSORS';
      maxCount = scissorsCount;
    }

    return {
      gameTitle: 'RPS Survival Infection',
      roundTimerSeconds: Math.floor(this.elapsedSeconds),
      leadingTeam: `${RPS_EMOJI[leader as RpsType]} ${leader}`,
      secondaryInfo: `FACTION LEADER: ${leader} (${maxCount}/75)`,
      leaderboardPreview: previews,
      suddenDeathActive: this.suddenDeathActive,
      statusText: this.suddenDeathActive ? 'SUDDEN DEATH // DUAL PURSUIT SPEED' : 'INFECTION SPREAD',
    };
  }

  public forceWinner(): RoundWinner {
    this.isEnded = true;
    const stats = this.getLiveStats();
    const leader = (stats.leadingTeam as string) || 'Rock';
    return {
      winner: leader,
      gameId: 'rps-arena',
      durationSeconds: Math.round(this.elapsedSeconds),
      reason: `Watchdog round timer expired! Faction had majority presence.`,
      colorHex: leader.includes('ROCK') ? RPS_COLORS.ROCK : leader.includes('PAPER') ? RPS_COLORS.PAPER : RPS_COLORS.SCISSORS,
    };
  }

  public dispose(): void {
    this.agents = [];
    this.bumpers = [];
    this.isEnded = true;
  }
}
