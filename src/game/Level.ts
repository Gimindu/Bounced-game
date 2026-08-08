import { Wall, Barrier, Rect } from './types';

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 1200;

export const createLevel = () => {
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

  return { walls, barriers, finishLine, chamberWidth, chamberHeight, startX, spacing };
};
