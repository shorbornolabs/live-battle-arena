import React, { useCallback, useEffect, useState } from 'react';
import { GAMES_LIST } from './constants';
import { audioSynth } from './core/AudioSynth';
import { wakeLockManager } from './core/WakeLockManager';
import { ControlDrawer } from './components/ControlDrawer';
import { LiveTicker } from './components/LiveTicker';
import { StreamHeader } from './components/StreamHeader';
import { WinnerOverlay } from './components/WinnerOverlay';
import { GameCanvasHost } from './games/GameCanvasHost';
import { AppSettings, GameId, GameLiveStats, RoundWinner } from './types';

const DEFAULT_SETTINGS: AppSettings = {
  autoPlaylist: true,
  roundsPerGame: 3,
  muted: false,
  fxVolume: 0.35,
  showFps: true,
  watchdogDurationSec: 120,
};

const INITIAL_LEADERBOARD: Record<string, number> = {
  RED: 18,
  CYAN: 16,
  LIME: 14,
  GOLD: 15,
  PURPLE: 11,
  ORANGE: 9,
};

export const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('neon_arena_settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [leaderboard, setLeaderboard] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('neon_arena_leaderboard');
      return saved ? JSON.parse(saved) : INITIAL_LEADERBOARD;
    } catch {
      return INITIAL_LEADERBOARD;
    }
  });

  const [currentGameIndex, setCurrentGameIndex] = useState<number>(0);
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [liveStats, setLiveStats] = useState<GameLiveStats | null>(null);
  const [winnerOverlay, setWinnerOverlay] = useState<RoundWinner | null>(null);
  const [isControlsOpen, setIsControlsOpen] = useState<boolean>(false);

  const currentGame = GAMES_LIST[currentGameIndex] || GAMES_LIST[0];

  // Request WakeLock to prevent Android screen sleep
  useEffect(() => {
    wakeLockManager.request();

    const handleFirstGesture = () => {
      audioSynth.resume();
      wakeLockManager.request();
      window.removeEventListener('click', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
    };

    window.addEventListener('click', handleFirstGesture);
    window.addEventListener('touchstart', handleFirstGesture);

    return () => {
      window.removeEventListener('click', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
      wakeLockManager.release();
    };
  }, []);

  // Save settings
  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem('neon_arena_settings', JSON.stringify(updated));
      } catch {}
      if (typeof newSettings.muted === 'boolean') {
        audioSynth.setMuted(newSettings.muted);
      }
      return updated;
    });
  };

  const resetLeaderboard = () => {
    setLeaderboard(INITIAL_LEADERBOARD);
    try {
      localStorage.setItem('neon_arena_leaderboard', JSON.stringify(INITIAL_LEADERBOARD));
    } catch {}
  };

  // Switch to specific game channel
  const selectGame = (id: GameId) => {
    const idx = GAMES_LIST.findIndex((g) => g.id === id);
    if (idx !== -1) {
      setCurrentGameIndex(idx);
      setCurrentRound(1);
      setWinnerOverlay(null);
    }
  };

  // Next round / Next game playlist logic
  const advancePlaylist = useCallback(() => {
    if (currentRound < settings.roundsPerGame) {
      setCurrentRound((prev) => prev + 1);
    } else {
      // Rotate to next game
      if (settings.autoPlaylist) {
        setCurrentGameIndex((prev) => (prev + 1) % GAMES_LIST.length);
      }
      setCurrentRound(1);
    }
    setWinnerOverlay(null);
  }, [currentRound, settings.roundsPerGame, settings.autoPlaylist]);

  // Round Won callback
  const handleRoundWin = useCallback(
    (winner: RoundWinner) => {
      setWinnerOverlay(winner);

      // Record win in leaderboard
      const key = winner.winner.replace(/[^a-zA-Z]/g, '').toUpperCase() || 'RED';
      setLeaderboard((prev) => {
        const next = { ...prev, [key]: (prev[key] || 0) + 1 };
        try {
          localStorage.setItem('neon_arena_leaderboard', JSON.stringify(next));
        } catch {}
        return next;
      });

      // 3.0s celebration window before auto-starting next match
      setTimeout(() => {
        advancePlaylist();
      }, 3000);
    },
    [advancePlaylist]
  );

  const forceNextRound = () => {
    advancePlaylist();
  };

  const nextGameTitle =
    currentRound >= settings.roundsPerGame && settings.autoPlaylist
      ? GAMES_LIST[(currentGameIndex + 1) % GAMES_LIST.length].title
      : currentGame.title;

  const nextRoundNumber =
    currentRound >= settings.roundsPerGame ? 1 : currentRound + 1;

  return (
    <div className="w-full h-full min-h-screen bg-[#030508] flex items-center justify-center overflow-hidden">
      {/* 9:16 Responsive Container centered on viewport (100% on phones) */}
      <div className="relative w-full h-full max-w-[450px] aspect-[9/16] max-h-screen bg-[#07090F] flex flex-col justify-between overflow-hidden shadow-2xl border-x border-cyan-500/10">
        {/* Stream Header with 5-Game Selection Navigation */}
        <StreamHeader
          currentGameId={currentGame.id}
          currentRound={currentRound}
          totalRounds={settings.roundsPerGame}
          liveStats={liveStats}
          isMuted={settings.muted}
          onToggleMute={() => updateSettings({ muted: !settings.muted })}
          onOpenControls={() => setIsControlsOpen(true)}
          autoPlaylist={settings.autoPlaylist}
          onSelectGame={selectGame}
          onPrevGame={() =>
            selectGame(GAMES_LIST[(currentGameIndex - 1 + GAMES_LIST.length) % GAMES_LIST.length].id)
          }
          onNextGame={() =>
            selectGame(GAMES_LIST[(currentGameIndex + 1) % GAMES_LIST.length].id)
          }
          onToggleAutoPlaylist={() =>
            updateSettings({ autoPlaylist: !settings.autoPlaylist })
          }
          onSkipRound={forceNextRound}
        />

        {/* 60FPS Game Canvas Host */}
        <div className="flex-1 w-full h-full relative">
          <GameCanvasHost
            key={`${currentGame.id}_${currentRound}`}
            gameId={currentGame.id}
            onRoundWin={handleRoundWin}
            onStatsUpdate={setLiveStats}
          />
        </div>

        {/* Live Ticker Bar */}
        <LiveTicker stats={liveStats} leaderboard={leaderboard} />

        {/* Winner Celebration Overlay */}
        <WinnerOverlay
          winner={winnerOverlay}
          nextGameTitle={nextGameTitle}
          nextRoundNumber={nextRoundNumber}
          totalRounds={settings.roundsPerGame}
        />

        {/* Control Drawer */}
        <ControlDrawer
          isOpen={isControlsOpen}
          onClose={() => setIsControlsOpen(false)}
          settings={settings}
          onUpdateSettings={updateSettings}
          currentGameId={currentGame.id}
          onSelectGame={selectGame}
          onForceNextRound={forceNextRound}
          onResetLeaderboard={resetLeaderboard}
        />
      </div>
    </div>
  );
};

export default App;
