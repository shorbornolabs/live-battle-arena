export type TeamColor = 'RED' | 'CYAN' | 'LIME' | 'GOLD' | 'PURPLE' | 'ORANGE';

export type GameId =
  | 'spinning-rings'
  | 'territory-wars'
  | 'rps-arena'
  | 'marble-race'
  | 'snake-royale';

export interface GameInfo {
  id: GameId;
  channelNumber: number;
  title: string;
  shortName: string;
  icon: string;
  description: string;
}

export interface GameLiveStats {
  gameTitle: string;
  roundTimerSeconds: number;
  leadingTeam?: TeamColor | string;
  secondaryInfo?: string;
  leaderboardPreview?: { name: string; score: string | number; color: string }[];
  statusText?: string;
  suddenDeathActive: boolean;
}

export interface RoundWinner {
  winner: TeamColor | string;
  gameId: GameId;
  durationSeconds: number;
  reason: string;
  details?: string;
  colorHex: string;
}

export interface IGameEngine {
  init(canvas: HTMLCanvasElement, width: number, height: number): void;
  update(dt: number): RoundWinner | null;
  render(ctx: CanvasRenderingContext2D, width: number, height: number): void;
  getLiveStats(): GameLiveStats;
  forceWinner(): RoundWinner;
  dispose(): void;
  resize?(width: number, height: number): void;
}

export interface AppSettings {
  autoPlaylist: boolean;
  roundsPerGame: number;
  muted: boolean;
  fxVolume: number;
  showFps: boolean;
  watchdogDurationSec: number;
}

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
}
