import React, { useEffect, useState } from 'react';
import { audioSynth } from '../core/AudioSynth';
import { RoundWinner } from '../types';

interface WinnerOverlayProps {
  winner: RoundWinner | null;
  nextGameTitle?: string;
  nextRoundNumber: number;
  totalRounds: number;
}

export const WinnerOverlay: React.FC<WinnerOverlayProps> = ({
  winner,
  nextGameTitle,
  nextRoundNumber,
  totalRounds,
}) => {
  const [countdown, setCountdown] = useState<number>(3);

  useEffect(() => {
    if (!winner) return;

    audioSynth.playVictoryChord();
    setCountdown(3);

    const interval = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [winner]);

  if (!winner) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      {/* Radiant Glow Behind Trophy */}
      <div
        className="w-48 h-48 rounded-full blur-3xl opacity-40 absolute pointer-events-none"
        style={{ backgroundColor: winner.colorHex || '#FFE600' }}
      />

      {/* Trophy / Crown Icon */}
      <div className="relative text-5xl mb-2 animate-bounce">
        🏆
      </div>

      <div className="text-[12px] font-mono tracking-widest text-yellow-400 font-bold uppercase mb-1">
        ROUND CHAMPION
      </div>

      {/* Winner Title */}
      <h2
        className="text-3xl font-black tracking-wider text-center drop-shadow-[0_0_15px_currentColor] mb-2"
        style={{ color: winner.colorHex || '#FFFFFF' }}
      >
        {winner.winner}
      </h2>

      {/* Reason Card */}
      <div className="max-w-xs px-4 py-2.5 rounded-xl bg-gray-950/80 border border-white/20 text-center mb-4 shadow-2xl">
        <p className="text-xs text-gray-200 font-medium leading-relaxed">
          {winner.reason}
        </p>
        <div className="mt-1.5 text-[10px] font-mono text-gray-400">
          Match Duration: {winner.durationSeconds}s
        </div>
      </div>

      {/* Next Match Auto-Start Indicator */}
      <div className="flex flex-col items-center space-y-1 text-center">
        <div className="flex items-center space-x-2 text-xs font-mono text-cyan-300">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span>
            AUTO-STARTING IN {countdown}s...
          </span>
        </div>
        <div className="text-[10px] text-gray-400 font-mono">
          Next: {nextGameTitle || 'Next Match'} (Round {nextRoundNumber}/{totalRounds})
        </div>
      </div>
    </div>
  );
};
