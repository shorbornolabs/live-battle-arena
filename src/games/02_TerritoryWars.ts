import { TEAM_COLORS, WATCHDOG_MAX_ROUND_DURATION_SEC } from '../constants';
import { audioSynth } from '../core/AudioSynth';
import { ParticlePool } from '../core/ParticlePool';
import { GameLiveStats, IGameEngine, RoundWinner, TeamColor } from '../types';

const COLS = 24;
const ROWS = 40;
const MAX_BULLETS_PER_TEAM = 120;

interface Bullet {
  active: boolean;
  team: TeamColor;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  bounces: number;
}

interface SplitGate {
  x: number;
  y: number;
  w: number;
  h: number;
  vy: number;
  label: string;
}

export class TerritoryWarsGame implements IGameEngine {
  private width: number = 360;
  private height: number = 640;
  private grid: TeamColor[][] = [];
  private bullets: Bullet[] = [];
  private pool: ParticlePool;
  private elapsedSeconds: number = 0;
  private isEnded: boolean = false;
  private suddenDeathActive: boolean = false;
  private cellW: number = 15;
  private cellH: number = 16;
  private fireCooldowns: Record<TeamColor, number> = {
    RED: 0,
    CYAN: 0,
    LIME: 0,
    GOLD: 0,
    PURPLE: 0,
    ORANGE: 0,
  };
  private turretAngles: Record<TeamColor, number> = {
    RED: Math.PI / 4,
    CYAN: (Math.PI * 3) / 4,
    LIME: (Math.PI * 7) / 4,
    GOLD: (Math.PI * 5) / 4,
    PURPLE: 0,
    ORANGE: 0,
  };
  private splitGates: SplitGate[] = [];

  constructor(pool: ParticlePool) {
    this.pool = pool;
  }

  public init(canvas: HTMLCanvasElement, width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.elapsedSeconds = 0;
    this.isEnded = false;
    this.suddenDeathActive = false;

    this.cellW = width / COLS;
    this.cellH = height / ROWS;

    // Initialize 24x40 grid partitioned into 4 quadrants
    this.grid = [];
    const midX = COLS / 2;
    const midY = ROWS / 2;

    for (let r = 0; r < ROWS; r++) {
      const row: TeamColor[] = [];
      for (let c = 0; c < COLS; c++) {
        if (c < midX && r < midY) {
          row.push('RED'); // Top-Left
        } else if (c >= midX && r < midY) {
          row.push('CYAN'); // Top-Right
        } else if (c < midX && r >= midY) {
          row.push('LIME'); // Bottom-Left
        } else {
          row.push('GOLD'); // Bottom-Right
        }
      }
      this.grid.push(row);
    }

    // Pre-allocate fixed bullet array to prevent GC allocations
    const totalMaxBullets = MAX_BULLETS_PER_TEAM * 4;
    this.bullets = new Array(totalMaxBullets);
    for (let i = 0; i < totalMaxBullets; i++) {
      this.bullets[i] = {
        active: false,
        team: 'RED',
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        bounces: 0,
      };
    }

    // Moving center modifier gates
    this.splitGates = [
      {
        x: width * 0.35,
        y: height * 0.45,
        w: width * 0.3,
        h: 24,
        vy: 45,
        label: 'x2 SPLIT',
      },
      {
        x: width * 0.35,
        y: height * 0.55,
        w: width * 0.3,
        h: 24,
        vy: -45,
        label: 'BURST',
      },
    ];
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.cellW = width / COLS;
    this.cellH = height / ROWS;
  }

  private spawnBullet(team: TeamColor, x: number, y: number, vx: number, vy: number): boolean {
    for (let i = 0; i < this.bullets.length; i++) {
      const b = this.bullets[i];
      if (!b.active) {
        b.active = true;
        b.team = team;
        b.x = x;
        b.y = y;
        b.vx = vx;
        b.vy = vy;
        b.life = 4.0;
        b.bounces = 0;
        return true;
      }
    }
    return false;
  }

  public update(dt: number): RoundWinner | null {
    if (this.isEnded) return null;
    this.elapsedSeconds += dt;

    if (this.elapsedSeconds >= 60 && !this.suddenDeathActive) {
      this.suddenDeathActive = true;
    }

    // Sudden death multiplier
    const speedBoost = this.suddenDeathActive ? 1.0 + Math.min(2.0, (this.elapsedSeconds - 60) * 0.04) : 1.0;
    const fireInterval = Math.max(0.12, (0.35 / speedBoost));

    // Update Split Gates
    for (let i = 0; i < this.splitGates.length; i++) {
      const gate = this.splitGates[i];
      gate.y += gate.vy * dt;
      if (gate.y < this.height * 0.25 || gate.y > this.height * 0.75) {
        gate.vy *= -1;
      }
    }

    // Turret positions and firing
    const teams: TeamColor[] = ['RED', 'CYAN', 'LIME', 'GOLD'];
    const turretPos: Record<TeamColor, { x: number; y: number; minAngle: number; maxAngle: number }> = {
      RED: { x: 8, y: 8, minAngle: 0.1, maxAngle: Math.PI / 2 - 0.1 },
      CYAN: { x: this.width - 8, y: 8, minAngle: Math.PI / 2 + 0.1, maxAngle: Math.PI - 0.1 },
      LIME: { x: 8, y: this.height - 8, minAngle: (Math.PI * 3) / 2 + 0.1, maxAngle: Math.PI * 2 - 0.1 },
      GOLD: { x: this.width - 8, y: this.height - 8, minAngle: Math.PI + 0.1, maxAngle: (Math.PI * 3) / 2 - 0.1 },
      PURPLE: { x: 0, y: 0, minAngle: 0, maxAngle: 0 },
      ORANGE: { x: 0, y: 0, minAngle: 0, maxAngle: 0 },
    };

    const time = this.elapsedSeconds * 2.2;
    for (let t = 0; t < teams.length; t++) {
      const team = teams[t];
      const cfg = turretPos[team];
      const span = cfg.maxAngle - cfg.minAngle;
      // Oscillate turret angle
      this.turretAngles[team] = cfg.minAngle + ((Math.sin(time + t * 1.5) + 1) / 2) * span;

      this.fireCooldowns[team] -= dt;
      if (this.fireCooldowns[team] <= 0) {
        this.fireCooldowns[team] = fireInterval + Math.random() * 0.05;
        const angle = this.turretAngles[team];
        const bulletSpeed = (240 + Math.random() * 40) * speedBoost;
        const vx = Math.cos(angle) * bulletSpeed;
        const vy = Math.sin(angle) * bulletSpeed;
        this.spawnBullet(team, cfg.x, cfg.y, vx, vy);
      }
    }

    // Update bullets
    for (let i = 0; i < this.bullets.length; i++) {
      const b = this.bullets[i];
      if (!b.active) continue;

      b.life -= dt;
      if (b.life <= 0) {
        b.active = false;
        continue;
      }

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Arena walls bounce
      if (b.x <= 0) {
        b.x = 0;
        b.vx *= -1;
        b.bounces++;
      } else if (b.x >= this.width) {
        b.x = this.width;
        b.vx *= -1;
        b.bounces++;
      }

      if (b.y <= 0) {
        b.y = 0;
        b.vy *= -1;
        b.bounces++;
      } else if (b.y >= this.height) {
        b.y = this.height;
        b.vy *= -1;
        b.bounces++;
      }

      // Check Gate collisions
      for (let g = 0; g < this.splitGates.length; g++) {
        const gate = this.splitGates[g];
        if (
          b.x >= gate.x &&
          b.x <= gate.x + gate.w &&
          b.y >= gate.y &&
          b.y <= gate.y + gate.h &&
          b.bounces < 2
        ) {
          b.bounces = 3;
          audioSynth.playGatePass();
          this.pool.spawn(b.x, b.y, '#00F0FF', 6, 1.2, 3);
          // Duplicate bullet at divergent angle
          const angle1 = Math.atan2(b.vy, b.vx) + 0.35;
          const spd = Math.hypot(b.vx, b.vy);
          this.spawnBullet(b.team, b.x, b.y, Math.cos(angle1) * spd, Math.sin(angle1) * spd);
        }
      }

      // Grid cell impact check
      const col = Math.floor(b.x / this.cellW);
      const row = Math.floor(b.y / this.cellH);

      if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
        const currentTileTeam = this.grid[row][col];
        if (currentTileTeam !== b.team) {
          // Flip tile to bullet's team!
          this.grid[row][col] = b.team;
          b.active = false;
          this.pool.spawn(b.x, b.y, TEAM_COLORS[b.team], 5, 0.8, 2.5);
          audioSynth.playTerritoryPop();
        }
      }
    }

    // Check domination victory
    const counts: Record<TeamColor, number> = {
      RED: 0,
      CYAN: 0,
      LIME: 0,
      GOLD: 0,
      PURPLE: 0,
      ORANGE: 0,
    };
    const totalCells = ROWS * COLS;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        counts[this.grid[r][c]]++;
      }
    }

    for (let t = 0; t < teams.length; t++) {
      const team = teams[t];
      if (counts[team] === totalCells) {
        this.isEnded = true;
        return {
          winner: team,
          gameId: 'territory-wars',
          durationSeconds: Math.round(this.elapsedSeconds),
          reason: '100% Total Arena Map Conquest!',
          colorHex: TEAM_COLORS[team],
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
    ctx.fillStyle = '#07090F';
    ctx.fillRect(0, 0, width, height);

    // Render Grid
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const team = this.grid[r][c];
        ctx.fillStyle = TEAM_COLORS[team];
        ctx.globalAlpha = 0.38;
        ctx.fillRect(c * this.cellW + 0.5, r * this.cellH + 0.5, this.cellW - 1, this.cellH - 1);
      }
    }

    // Render Center Modifier Gates
    for (let g = 0; g < this.splitGates.length; g++) {
      const gate = this.splitGates[g];
      ctx.save();
      ctx.shadowColor = '#00F0FF';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#00F0FF';
      ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(0, 240, 255, 0.2)';
      ctx.fillRect(gate.x, gate.y, gate.w, gate.h);
      ctx.strokeRect(gate.x, gate.y, gate.w, gate.h);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(gate.label, gate.x + gate.w / 2, gate.y + gate.h / 2);
      ctx.restore();
    }

    // Render Bullets
    for (let i = 0; i < this.bullets.length; i++) {
      const b = this.bullets[i];
      if (!b.active) continue;

      const color = TEAM_COLORS[b.team];
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Render Corner Turrets
    const corners: { team: TeamColor; x: number; y: number }[] = [
      { team: 'RED', x: 0, y: 0 },
      { team: 'CYAN', x: width, y: 0 },
      { team: 'LIME', x: 0, y: height },
      { team: 'GOLD', x: width, y: height },
    ];

    for (let i = 0; i < corners.length; i++) {
      const c = corners[i];
      const angle = this.turretAngles[c.team];
      const color = TEAM_COLORS[c.team];

      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;

      // Turret base
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 22, 0, Math.PI * 2);
      ctx.fill();

      // Turret barrel
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x + Math.cos(angle) * 32, c.y + Math.sin(angle) * 32);
      ctx.stroke();

      ctx.restore();
    }

    ctx.restore();
  }

  public getLiveStats(): GameLiveStats {
    const counts: Record<TeamColor, number> = {
      RED: 0,
      CYAN: 0,
      LIME: 0,
      GOLD: 0,
      PURPLE: 0,
      ORANGE: 0,
    };
    const totalCells = ROWS * COLS;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        counts[this.grid[r][c]]++;
      }
    }

    const teams: TeamColor[] = ['RED', 'CYAN', 'LIME', 'GOLD'];
    let bestPct = -1;
    let leader: TeamColor = 'RED';

    const previews = teams.map((team) => {
      const pct = Math.round((counts[team] / totalCells) * 100);
      if (pct > bestPct) {
        bestPct = pct;
        leader = team;
      }
      return {
        name: team,
        score: `${pct}%`,
        color: TEAM_COLORS[team],
      };
    });

    return {
      gameTitle: '4-Corner Territory Wars',
      roundTimerSeconds: Math.floor(this.elapsedSeconds),
      leadingTeam: leader,
      secondaryInfo: `GRID DOMINANCE: ${leader} (${bestPct}%)`,
      leaderboardPreview: previews,
      suddenDeathActive: this.suddenDeathActive,
      statusText: this.suddenDeathActive ? 'SUDDEN DEATH // HYPER RAPID-FIRE' : 'CONQUEST IN PROGRESS',
    };
  }

  public forceWinner(): RoundWinner {
    this.isEnded = true;
    const stats = this.getLiveStats();
    const leader = (stats.leadingTeam as TeamColor) || 'RED';
    return {
      winner: leader,
      gameId: 'territory-wars',
      durationSeconds: Math.round(this.elapsedSeconds),
      reason: `Watchdog expired! Leading with territory dominance.`,
      colorHex: TEAM_COLORS[leader],
    };
  }

  public dispose(): void {
    this.grid = [];
    this.bullets = [];
    this.isEnded = true;
  }
}
