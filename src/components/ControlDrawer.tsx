import React, { useEffect, useRef } from 'react';
import { GAMES_LIST } from '../constants';
import { AppSettings, GameId } from '../types';

interface ControlDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  currentGameId: GameId;
  onSelectGame: (id: GameId) => void;
  onForceNextRound: () => void;
  onResetLeaderboard: () => void;
}

export const ControlDrawer: React.FC<ControlDrawerProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  currentGameId,
  onSelectGame,
  onForceNextRound,
  onResetLeaderboard,
}) => {
  const autoHideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-hide drawer after 5s of inactivity
  const resetAutoHideTimer = () => {
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
    }
    autoHideTimerRef.current = setTimeout(() => {
      onClose();
    }, 5000);
  };

  useEffect(() => {
    if (isOpen) {
      resetAutoHideTimer();
    } else if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
    }
    return () => {
      if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="absolute inset-0 z-40 bg-black/70 backdrop-blur-sm flex justify-end"
      onClick={onClose}
    >
      <div
        className="w-72 h-full bg-[#0B0F19] border-l border-white/10 p-4 flex flex-col justify-between overflow-y-auto select-none"
        onClick={(e) => {
          e.stopPropagation();
          resetAutoHideTimer();
        }}
      >
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center space-x-2">
              <span className="text-lg">⚙️</span>
              <h3 className="font-bold text-white text-sm tracking-wide font-mono">
                ARCADE CONTROLS
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-lg font-mono p-1"
            >
              ✕
            </button>
          </div>

          {/* Auto-Playlist Toggle */}
          <div className="flex items-center justify-between p-2 rounded-lg bg-gray-900/80 border border-white/10">
            <div>
              <div className="text-xs font-bold text-white font-mono">
                AUTO-PLAYLIST
              </div>
              <div className="text-[10px] text-gray-400">
                Rotates games automatically
              </div>
            </div>
            <button
              onClick={() =>
                onUpdateSettings({ autoPlaylist: !settings.autoPlaylist })
              }
              className={`px-3 py-1 rounded text-xs font-bold font-mono transition-all ${
                settings.autoPlaylist
                  ? 'bg-cyan-500 text-black shadow-[0_0_8px_rgba(0,240,255,0.6)]'
                  : 'bg-gray-800 text-gray-400'
              }`}
            >
              {settings.autoPlaylist ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Rounds Per Game Slider */}
          <div className="p-2 rounded-lg bg-gray-900/80 border border-white/10">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-white font-mono">
                ROUNDS PER GAME
              </span>
              <span className="text-xs font-mono font-bold text-yellow-400">
                {settings.roundsPerGame}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={settings.roundsPerGame}
              onChange={(e) =>
                onUpdateSettings({ roundsPerGame: parseInt(e.target.value) })
              }
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Audio Mute */}
          <div className="flex items-center justify-between p-2 rounded-lg bg-gray-900/80 border border-white/10">
            <div>
              <div className="text-xs font-bold text-white font-mono">
                SYNTH AUDIO SFX
              </div>
              <div className="text-[10px] text-gray-400">
                Procedural Web Audio
              </div>
            </div>
            <button
              onClick={() => onUpdateSettings({ muted: !settings.muted })}
              className={`px-3 py-1 rounded text-xs font-bold font-mono transition-all ${
                !settings.muted
                  ? 'bg-lime-500 text-black shadow-[0_0_8px_rgba(57,255,20,0.6)]'
                  : 'bg-gray-800 text-gray-400'
              }`}
            >
              {!settings.muted ? 'ACTIVE' : 'MUTED'}
            </button>
          </div>

          {/* Game Switcher Direct Channels */}
          <div>
            <div className="text-[11px] font-bold text-gray-400 uppercase font-mono tracking-wider mb-1.5">
              CHANNELS (DIRECT JUMP)
            </div>
            <div className="space-y-1.5">
              {GAMES_LIST.map((game) => (
                <button
                  key={game.id}
                  onClick={() => {
                    onSelectGame(game.id);
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-lg border text-left transition-all ${
                    currentGameId === game.id
                      ? 'bg-cyan-950/60 border-cyan-400 text-cyan-200 shadow-[0_0_8px_rgba(0,240,255,0.3)]'
                      : 'bg-gray-900/60 border-white/5 text-gray-300 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-sm">{game.icon}</span>
                    <div>
                      <div className="text-xs font-bold">{game.title}</div>
                      <div className="text-[9px] text-gray-400 font-mono">
                        CH-0{game.channelNumber}
                      </div>
                    </div>
                  </div>
                  {currentGameId === game.id && (
                    <span className="text-[10px] font-mono text-cyan-400 font-bold">
                      PLAYING
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="space-y-2 pt-4 border-t border-white/10">
          <button
            onClick={() => {
              onForceNextRound();
              onClose();
            }}
            className="w-full py-2 rounded bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 font-mono font-bold text-xs hover:bg-yellow-500/30 active:scale-98 transition-all"
          >
            ⏩ FORCE NEXT ROUND
          </button>

          <button
            onClick={() => {
              onResetLeaderboard();
              onClose();
            }}
            className="w-full py-2 rounded bg-red-950/40 border border-red-500/30 text-red-300 font-mono text-[10px] hover:bg-red-950/70 active:scale-98 transition-all"
          >
            RESET ALL-TIME STATS
          </button>
        </div>
      </div>
    </div>
  );
};
