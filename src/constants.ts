import { GameId, GameInfo, TeamColor } from './types';

export const TEAM_COLORS: Record<TeamColor, string> = {
  RED: '#FF2E63',
  CYAN: '#00F0FF',
  LIME: '#39FF14',
  GOLD: '#FFE600',
  PURPLE: '#B026FF',
  ORANGE: '#FF7700',
};

export const TEAM_NAMES: Record<TeamColor, string> = {
  RED: 'Team Crimson',
  CYAN: 'Team Neon Cyan',
  LIME: 'Team Acid Lime',
  GOLD: 'Team Sol Gold',
  PURPLE: 'Team Cyber Violet',
  ORANGE: 'Team Plasma Orange',
};

export const COLOR_GLOWS: Record<TeamColor, string> = {
  RED: 'rgba(255, 46, 99, 0.45)',
  CYAN: 'rgba(0, 240, 255, 0.45)',
  LIME: 'rgba(57, 255, 20, 0.45)',
  GOLD: 'rgba(255, 230, 0, 0.45)',
  PURPLE: 'rgba(176, 38, 255, 0.45)',
  ORANGE: 'rgba(255, 119, 0, 0.45)',
};

export const RPS_COLORS = {
  ROCK: '#FF2E63',
  PAPER: '#00F0FF',
  SCISSORS: '#FFE600',
};

export const WATCHDOG_MAX_ROUND_DURATION_SEC = 120;
export const SUDDEN_DEATH_THRESHOLD_SEC = 60;
export const MAX_PARTICLES = 200;

export const GAMES_LIST: GameInfo[] = [
  {
    id: 'spinning-rings',
    channelNumber: 1,
    title: 'Spinning Rings Escape',
    shortName: 'Rings Escape',
    icon: '⭕',
    description: '10 concentric rotating neon rings. Pass through gaps to shatter them and escape!',
  },
  {
    id: 'territory-wars',
    channelNumber: 2,
    title: '4-Corner Territory Wars',
    shortName: 'Territory Wars',
    icon: '⚔️',
    description: '4 auto-turrets firing bouncy plasma lasers to conquer the 24x40 grid arena.',
  },
  {
    id: 'rps-arena',
    channelNumber: 3,
    title: 'RPS Survival Infection',
    shortName: 'RPS Battle',
    icon: '✂️',
    description: '75 autonomous Rock, Paper, Scissors entities in a predatory infection ring.',
  },
  {
    id: 'marble-race',
    channelNumber: 4,
    title: 'Marble Obstacle Race',
    shortName: 'Marble Race',
    icon: '🏁',
    description: '6 neon marbles plunging through a 4000px procedural vertical obstacle run.',
  },
  {
    id: 'snake-royale',
    channelNumber: 5,
    title: 'Neon Snake Battle Royale',
    shortName: 'Snake Royale',
    icon: '🐍',
    description: '6 autonomous snakes with raycast evasion battling within a shrinking hazard zone.',
  },
];
