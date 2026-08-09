import { Wall, Barrier, Rect, LevelData, UnifiedPiston, Knife, Vector2 } from './types';

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 1200;

export const createLevel = (): LevelData => {
  const walls: Wall[] = [];
  const barriers: Barrier[] = [];
  
  const thickness = 20;

  // Outer boundaries enclosing the entire maze
  walls.push({ x: 50, y: 130, width: 700, height: thickness }); // Top Wall
  walls.push({ x: 50, y: 130, width: thickness, height: 1010 }); // Left Wall
  walls.push({ x: 730, y: 130, width: thickness, height: 1010 }); // Right Wall
  walls.push({ x: 50, y: 1120, width: 700, height: thickness }); // Bottom Wall (Master Floor)
  
  // Floor 0 (Chambers Floor, drop is on the right)
  walls.push({ x: 50, y: 400, width: 580, height: thickness }); 
  // Gap is from x=630 to 730

  // Chambers setup
  const startX = 100;
  const chamberWidth = 100;
  const chamberHeight = 150;
  const spacing = 20;
  
  const doorColors = ['red', 'blue', 'yellow', 'green'] as const;

  // Chamber dividers and doors
  for (let i = 0; i < 4; i++) {
    const wallX = startX + chamberWidth + i * (chamberWidth + spacing);
    
    // Top half solid wall
    walls.push({
      x: wallX,
      y: 150,
      width: thickness,
      height: 125
    });
    
    // Bottom half colored door (made of 5 separate blocks)
    for (let b = 0; b < 5; b++) {
      barriers.push({
        id: `barrier-${i}-${b}`,
        color: doorColors[i],
        x: wallX,
        y: 275 + b * 25,
        width: thickness,
        height: 25,
        isActive: true
      });
    }
  }

  // Floor 1 (Drop is on the left)
  walls.push({ x: 150, y: 580, width: 580, height: thickness });
  
  // Floor 2 (Drop is on the right)
  walls.push({ x: 50, y: 760, width: 580, height: thickness });
  
  // Floor 3 (Drop is on the left)
  walls.push({ x: 150, y: 940, width: 580, height: thickness });

  // Finish Line on Floor 4 (Bottom Wall)
  const finishLine: Rect = {
    x: 600,
    y: 950, // Sits exactly on the bottom wall (1120 - 170)
    width: 128,
    height: 170
  };

  // Function to add a floor-to-ceiling black door made of blocks
  const addBlackDoor = (x: number, yTop: number) => {
    // 160px gap divided into 4 blocks of 40px
    for (let i = 0; i < 4; i++) {
      barriers.push({
        id: `barrier-black-${x}-${i}`,
        color: 'black',
        x: x,
        y: yTop + i * 40,
        width: thickness,
        height: 40,
        isActive: true
      });
    }
  };

  // Black obstacles on each floor blocking the entire path
  addBlackDoor(350, 420); // Floor 1 (y=420 to 580)
  addBlackDoor(500, 600); // Floor 2 (y=600 to 760)
  addBlackDoor(250, 780); // Floor 3 (y=780 to 940)

  // Initialize unified cascading pistons (acts like a liquid snake)
  const pistons: UnifiedPiston[] = [];
  
  // Group 0: Chambers & Fillers (t=0)
  for (let i = 0; i < 4; i++) {
    pistons.push({
      type: 'vertical', x: startX + i * (chamberWidth + spacing),
      y: 150, width: chamberWidth, height: 0, maxVal: 130, delay: 0
    });
  }
  // Fill left gap (x=70 to 100)
  pistons.push({ type: 'vertical', x: 70, y: 150, width: 30, height: 0, maxVal: 130, delay: 0 });
  // Fill gap between chamber 3 and right drop (x=560 to 630)
  pistons.push({ type: 'vertical', x: 560, y: 150, width: 70, height: 0, maxVal: 130, delay: 0 });
  // Fill top of Right Gap (x=630 to 730)
  pistons.push({ type: 'vertical', x: 630, y: 150, width: 100, height: 0, maxVal: 130, delay: 0 });

  // Group 1: Floor 0 Sweep Right (Starts at 2.6s, sweeps from 70 to 630, height 120 to reach Floor 0)
  pistons.push({ type: 'horizontal_right', x: 70, y: 280, width: 0, height: 120, maxVal: 560, delay: 2.6 });

  // Group 2: Right Gap Floor 0 to 1 (Starts at 13.8s, pours from 280 down to Floor 1 ceiling at 420)
  pistons.push({ type: 'vertical', x: 630, y: 280, width: 100, height: 0, maxVal: 140, delay: 13.8 });

  // Group 3: Floor 1 Sweep Left (Starts at 16.6s, sweeps from right wall 730 left to 150)
  pistons.push({ type: 'horizontal_left', x: 730, y: 420, width: 0, height: 160, maxVal: 580, delay: 16.6, anchorX: 730 });

  // Group 4: Left Gap Floor 1 to 2 (Starts at 28.2s, pours from 420 down to Floor 2 ceiling at 600)
  pistons.push({ type: 'vertical', x: 70, y: 420, width: 80, height: 0, maxVal: 180, delay: 28.2 });

  // Group 5: Floor 2 Sweep Right (Starts at 31.8s, sweeps from left wall 70 right to 630)
  pistons.push({ type: 'horizontal_right', x: 70, y: 600, width: 0, height: 160, maxVal: 560, delay: 31.8 });

  // Group 6: Right Gap Floor 2 to 3 (Starts at 43.0s, pours from 600 down to Floor 3 ceiling at 780)
  pistons.push({ type: 'vertical', x: 630, y: 600, width: 100, height: 0, maxVal: 180, delay: 43.0 });

  // Group 7: Floor 3 Sweep Left (Starts at 46.6s, sweeps from right wall 730 left to 150)
  pistons.push({ type: 'horizontal_left', x: 730, y: 780, width: 0, height: 160, maxVal: 580, delay: 46.6, anchorX: 730 });
  
  // Knives
  const knives: Knife[] = [];
  knives.push({
    id: `knife-100`,
    x: 110,
    y: 490, // Centered in slot 100
    width: 30,
    height: 30,
    pickedUpBy: null
  });

  // Start Points for the 4 players
  const startPoints: Vector2[] = [];
  for (let i = 0; i < 4; i++) {
    const cx = startX + i * (chamberWidth + spacing) + chamberWidth / 2;
    const cy = 150 + chamberHeight / 2;
    startPoints.push({ x: cx - 15, y: cy - 15 });
  }

  return { walls, barriers, finishLine, pistons, knives, startPoints };
};
