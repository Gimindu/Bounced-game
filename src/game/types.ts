export type Color = 'red' | 'blue' | 'green' | 'yellow' | 'black';
export type GameState = 'LOADING' | 'START' | 'PLAYING' | 'GAME_OVER' | 'WIN' | 'EDITOR';

export interface Vector2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Player {
  id: string;
  color: Color;
  x: number;
  y: number;
  width: number;
  height: number;
  velocity: { x: number, y: number };
  hasKnife: boolean;
  speed: number;
  health: number;
  maxHealth: number;
  isDead: boolean;
  deadTimer: number;
  trail: { x: number, y: number }[];
  squashX: number;
  squashY: number;
}

export interface Barrier extends Rect {
  id: string;
  color: Color;
  isActive: boolean;
}

export interface Wall extends Rect {}

export interface Knife extends Rect {
  id: string;
  pickedUpBy: string | null;
}

export interface UnifiedPiston extends Rect {
  type: 'vertical' | 'horizontal_left' | 'horizontal_right';
  maxVal: number;
  delay: number;
  anchorX?: number; // Used to keep the right edge of left-sweeping pistons anchored
}

export interface LevelData {
  walls: Wall[];
  barriers: Barrier[];
  pistons: UnifiedPiston[];
  knives: Knife[];
  finishLine: Rect;
  startPoints: Vector2[];
}
