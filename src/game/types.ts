export type Color = 'red' | 'blue' | 'green' | 'yellow' | 'black';
export type GameState = 'START' | 'PLAYING' | 'GAME_OVER' | 'WIN';

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
  isDead: boolean;
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
