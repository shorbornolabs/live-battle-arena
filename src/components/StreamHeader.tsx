import React, { useEffect, useState } from 'react';
import { GAMES_LIST } from '../constants';
import { GameId, GameLiveStats } from '../types';

interface StreamHeaderProps {
  currentGameId: GameId;
  currentRound: number;
  totalRounds: number;
  liveStats: GameLiveStats | null;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenControls: () => void;
  autoPlaylist: boolean;
  onSelectGame?: (gameId: GameId) => void;
  onPrevGame?: () => void;
  onNextGame?: () => void;
  onToggleAutoPlaylist?: () => void;
  onSkipRound?: () => void;
}

export const StreamHeader: React.FC<StreamHeaderProps> = ({
  currentGameId,
  currentRound,
  totalRounds,
  liveStats,
  isMuted,
  onToggleMute,
  onOpenControls,
  autoPlaylist,
  onSelectGame,
  onPrevGame,
  onNextGame,
  onToggleAutoPlaylist,
  onSkipRound,
}) => {
  const [viewers, setViewers] = useState<number>(14820);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const currentGame = GAMES_LIST.find((g) => g.id === currentGameId) || GAMES_LIST[0];

  useEffect(() => {
    const interval = setInterval(() => {
      setViewers((prev) => prev + Math.floor((Math.random() - 0.48) * 9));
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="absolute top-0 left-0 right-0 z-30 flex flex-col p-2.5 bg-gradient-to-b from-[#07090F]/95 via-[#07090F]/80 to-transparent pointer-events-none select-none">
      {/* Top Bar: Badges, Viewers & Quick Action Icons */}
      <div className="flex items-center justify-between pointer-events-auto">
        <div className="flex items-center space-x-1.5">
          <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-red-950/85 border border-red-500/70 shadow-[0_0_8px_rgba(239,68,68,0.5)]">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] font-black tracking-wider text-red-200">LIVE</span>
          </div>

          <div className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/50">
            <span className="text-[10px] font-mono font-bold text-cyan-300">
              CH-0{currentGame.channelNumber}
            </span>
          </div>

          {onToggleAutoPlaylist && (
            <button
              onClick={onToggleAutoPlaylist}
              className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border transition-all ${
                autoPlaylist
                  ? 'bg-purple-900/80 border-purple-500/50 text-purple-200'
                  : 'bg-gray-800/80 border-gray-600 text-gray-400'
              }`}
            >
              {autoPlaylist ? 'AUTO-LOOP' : 'MANUAL'}
            </button>
          )}
        </div>

        <div className="flex items-center space-x-1.5">
          {onSkipRound && (
            <button
              onClick={onSkipRound}
              className="h-7 px-2 flex items-center space-x-1 rounded bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/30 active:scale-95 text-[11px] font-mono font-bold transition-all"
            >
              <span>⏩</span>
              <span>SKIP</span>
            </button>
          )}

          <div className="flex items-center space-x-1 px-2 py-0.5 rounded bg-black/70 border border-white/10 text-[11px] font-mono text-gray-300">
            <span className="text-red-400">👁</span>
            <span>{viewers.toLocaleString()}</span>
          </div>

          <button
            onClick={onToggleMute}
            aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            className="w-7 h-7 flex items-center justify-center rounded bg-gray-900/90 border border-white/20 text-white hover:border-cyan-400 active:scale-95 transition-all text-xs"
          >
            {isMuted ? '🔇' : '🔊'}
          </button>

          <button
            onClick={onOpenControls}
            aria-label="Arcade Settings"
            className="w-7 h-7 flex items-center justify-center rounded bg-gray-900/90 border border-white/20 text-white hover:border-cyan-400 active:scale-95 transition-all text-xs"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Prominent On-Screen 5-Game Selection Dock */}
      {onSelectGame && (
        <nav className="flex items-center gap-1.5 mt-1.5 pointer-events-auto" aria-label="Game Channel Tabs">
          {onPrevGame && (
            <button
              onClick={onPrevGame}
              aria-label="Previous Game"
              className="w-9 h-10 flex items-center justify-center rounded-lg bg-slate-900/90 border border-cyan-500/40 text-cyan-400 font-bold hover:bg-cyan-500/20 active:scale-95 shadow-[0_0_8px_rgba(0,240,255,0.2)]"
            >
              ◀
            </button>
          )}

          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 flex-1">
            {GAMES_LIST.map((g) => {
              const isActive = g.id === currentGameId;
              return (
                <button
                  key={g.id}
                  onClick={() => onSelectGame(g.id)}
                  className={`flex items-center gap-1.5 min-h-[40px] px-2.5 py-1 rounded-lg border text-left whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-cyan-950/95 border-cyan-400 text-white shadow-[0_0_12px_rgba(0,240,255,0.5)]'
                      : 'bg-slate-900/80 border-white/15 text-slate-300 hover:border-white/30'
                  }`}
                >
                  <span className="text-base">{g.icon}</span>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-extrabold leading-tight tracking-tight">
                      {g.title.split(' ')[0]}
                    </span>
                    <span className="text-[9px] font-mono text-cyan-300 font-bold leading-tight">
                      CH-0{g.channelNumber}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {onNextGame && (
            <button
              onClick={onNextGame}
              aria-label="Next Game"
              className="w-9 h-10 flex items-center justify-center rounded-lg bg-slate-900/90 border border-cyan-500/40 text-cyan-400 font-bold hover:bg-cyan-500/20 active:scale-95 shadow-[0_0_8px_rgba(0,240,255,0.2)]"
            >
              ▶
            </button>
          )}
        </nav>
      )}

      {/* Subbar: Active Game Title & Round info */}
      <div className="flex items-center justify-between mt-1 text-xs pointer-events-auto">
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-1.5 px-2 py-1 rounded-md bg-slate-900/80 border border-cyan-500/30 text-white font-bold hover:border-cyan-400 active:scale-95 transition-all"
        >
          <span className="text-sm">{currentGame.icon}</span>
          <span className="tracking-wide drop-shadow-[0_0_6px_rgba(0,240,255,0.4)]">
            {currentGame.title}
          </span>
          <span className="text-[10px] text-cyan-400">▼</span>
        </button>

        <div className="flex items-center space-x-2 font-mono text-[11px]">
          <span className="text-yellow-400 font-semibold">
            ROUND {currentRound}/{totalRounds}
          </span>
          {liveStats && (
            <span className="text-gray-400">
              {Math.floor(liveStats.roundTimerSeconds)}s
            </span>
          )}
        </div>
      </div>

      {/* 5-Game Selection Modal */}
      {isModalOpen && (
        <div
          onClick={() => setIsModalOpen(false)}
          className="fixed inset-0 z-50 flex flex-col p-4 bg-black/85 backdrop-blur-md pointer-events-auto overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md mx-auto my-auto flex flex-col bg-slate-950 border border-cyan-500/30 rounded-xl p-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-cyan-500/20 mb-3">
              <div className="flex items-center gap-2 font-bold text-cyan-300 text-sm tracking-wide">
                <span>🎮</span>
                <span>CHOOSE A GAME CHANNEL</span>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded bg-white/10 text-white hover:bg-red-500/30"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {GAMES_LIST.map((g) => {
                const isActive = g.id === currentGameId;
                return (
                  <button
                    key={g.id}
                    onClick={() => {
                      if (onSelectGame) onSelectGame(g.id);
                      setIsModalOpen(false);
                    }}
                    className={`flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                      isActive
                        ? 'bg-cyan-950/80 border-cyan-400 shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                        : 'bg-slate-900/80 border-white/10 hover:border-white/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-black/50 border border-white/10 text-xl">
                        {g.icon}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-white flex items-center gap-1.5">
                          <span>{g.title}</span>
                          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded">
                            CH-0{g.channelNumber}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-400 line-clamp-1">{g.description}</div>
                      </div>
                    </div>

                    <div className="ml-2 shrink-0">
                      {isActive ? (
                        <span className="px-2 py-1 rounded bg-green-950 border border-green-500 text-green-300 text-[10px] font-mono font-bold">
                          ACTIVE
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded bg-cyan-400 text-black text-[10px] font-mono font-bold">
                          PLAY ▶
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
