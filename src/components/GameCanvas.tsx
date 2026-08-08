"use client";

import { useEffect, useRef } from 'react';
import { GameEngine } from '@/game/GameEngine';
import { Color } from '@/game/types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/game/Level';

interface GameCanvasProps {
  isPlaying: boolean;
  selectedColor: Color | null;
  onGameOver: () => void;
  onWin: () => void;
}

export default function GameCanvas({ isPlaying, selectedColor, onGameOver, onWin }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  useEffect(() => {
    if (canvasRef.current && !engineRef.current) {
      engineRef.current = new GameEngine(canvasRef.current);
      engineRef.current.onGameOver = onGameOver;
      engineRef.current.onWin = onWin;
    }
    
    return () => {
      if (engineRef.current) {
        engineRef.current.stop();
        engineRef.current = null;
      }
    };
  }, [onGameOver, onWin]);

  useEffect(() => {
    if (isPlaying && selectedColor && engineRef.current) {
      engineRef.current.startGame(selectedColor);
    } else if (!isPlaying && engineRef.current) {
      engineRef.current.stop();
    }
  }, [isPlaying, selectedColor]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      style={{
        height: '100%',
        maxHeight: '100%',
        width: 'auto',
        maxWidth: '100%',
        objectFit: 'contain',
        backgroundColor: '#d5d1c5',
        display: 'block',
      }}
    />
  );
}
