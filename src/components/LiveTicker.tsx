import React from 'react';
import { TEAM_COLORS } from '../constants';
import { GameLiveStats, TeamColor } from '../types';

interface LiveTickerProps {
  stats: GameLiveStats | null;
  leaderboard: Record<string, number>;
}

export const LiveTicker: React.FC<LiveTickerProps> = ({ stats, leaderboard }) => {
  return (
    <footer className="absolute bottom-0 left-0 right-0 z-30 flex flex-col p-2 bg-gradient-to-t from-[#07090F] via-[#07090F]/90 to-transparent pointer-events-none select-none text-[11px] font-mono">
      {/* Dynamic Status / Sudden Death Bar */}
      {stats && (
        <div className="flex items-center justify-between px-2 py-1 mb-1 rounded bg-black/60 border border-white/10 backdrop-blur-sm">
          <div className="flex items-center space-x-1.5 truncate">
            {stats.suddenDeathActive && (
              <span className="px-1.5 py-0.2 rounded bg-red-600 text-white font-bold animate-pulse text-[9px]">
                WARNING
              </span>
            )}
            <span className="text-gray-300 font-semibold truncate">
              {stats.secondaryInfo || stats.statusText}
            </span>
          </div>

          {stats.leadingTeam && (
            <div className="flex items-center space-x-1 ml-2 shrink-0">
              <span className="text-gray-400 text-[10px]">P1:</span>
              <span
                className="font-bold drop-shadow-[0_0_6px_currentColor]"
                style={{
                  color:
                    TEAM_COLORS[stats.leadingTeam as TeamColor] || '#00F0FF',
                }}
              >
                {stats.leadingTeam}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Mini Leaderboard Badges */}
      <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-0.5">
        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider shrink-0">
          ALL-TIME:
        </span>
        {Object.entries(leaderboard)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([team, wins]) => (
            <div
              key={team}
              className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-gray-900/80 border border-white/10 shrink-0"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor:
                    TEAM_COLORS[team as TeamColor] ||
                    (team.includes('ROCK')
                      ? '#FF2E63'
                      : team.includes('PAPER')
                      ? '#00F0FF'
                      : '#FFE600'),
                }}
              />
              <span className="text-gray-200 text-[10px] font-bold">{team}:</span>
              <span className="text-yellow-400 text-[10px] font-mono">{wins}W</span>
            </div>
          ))}
      </div>
    </footer>
  );
};
