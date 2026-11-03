import React, { useEffect, useRef } from 'react';
import { ParticlePool } from '../core/ParticlePool';
import { GameId, GameLiveStats, IGameEngine, RoundWinner } from '../types';
import { SpinningRingsGame } from './01_SpinningRings';
import { TerritoryWarsGame } from './02_TerritoryWars';
import { RpsArenaGame } from './03_RpsArena';
import { MarbleRaceGame } from './04_MarbleRace';
import { SnakeRoyaleGame } from './05_SnakeRoyale';

interface GameCanvasHostProps {
  gameId: GameId;
  onRoundWin: (winner: RoundWinner) => void;
  onStatsUpdate: (stats: GameLiveStats) => void;
}

export const GameCanvasHost: React.FC<GameCanvasHostProps> = ({
  gameId,
  onRoundWin,
  onStatsUpdate,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<IGameEngine | null>(null);
  const poolRef = useRef<ParticlePool>(new ParticlePool());
  const rafIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const statsThrottleRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Dispose old engine
    if (engineRef.current) {
      engineRef.current.dispose();
      engineRef.current = null;
    }

    // Reset particle pool
    poolRef.current.reset();

    // Create new engine according to gameId
    let engine: IGameEngine;
    switch (gameId) {
      case 'spinning-rings':
        engine = new SpinningRingsGame(poolRef.current);
        break;
      case 'territory-wars':
        engine = new TerritoryWarsGame(poolRef.current);
        break;
      case 'rps-arena':
        engine = new RpsArenaGame(poolRef.current);
        break;
      case 'marble-race':
        engine = new MarbleRaceGame(poolRef.current);
        break;
      case 'snake-royale':
        engine = new SnakeRoyaleGame(poolRef.current);
        break;
      default:
        engine = new SpinningRingsGame(poolRef.current);
    }
    engineRef.current = engine;

    // Handle high DPI scaling
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 360;
    const height = rect.height || 640;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    engine.init(canvas, width, height);

    lastTimeRef.current = performance.now();
    statsThrottleRef.current = 0;

    let isRoundOver = false;

    const loop = (now: number) => {
      if (isRoundOver) return;

      const rawDt = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;
      // Clamp dt to 0.05 max to avoid physics explosions during frame drops
      const dt = Math.min(0.05, Math.max(0.001, rawDt));

      // Update engine
      if (engineRef.current) {
        const winner = engineRef.current.update(dt);
        poolRef.current.update(dt);

        // Render
        ctx.clearRect(0, 0, width, height);
        engineRef.current.render(ctx, width, height);
        poolRef.current.render(ctx);

        // Throttle stats update to ~10 times per second
        statsThrottleRef.current += dt;
        if (statsThrottleRef.current >= 0.1) {
          statsThrottleRef.current = 0;
          onStatsUpdate(engineRef.current.getLiveStats());
        }

        if (winner && !isRoundOver) {
          isRoundOver = true;
          onRoundWin(winner);
          return;
        }
      }

      rafIdRef.current = requestAnimationFrame(loop);
    };

    rafIdRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (engineRef.current) {
        engineRef.current.dispose();
      }
    };
  }, [gameId, onRoundWin, onStatsUpdate]);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-[#07090F]">
      <canvas
        ref={canvasRef}
        className="w-full h-full block touch-none"
        style={{ imageRendering: 'auto' }}
      />
    </div>
  );
};
