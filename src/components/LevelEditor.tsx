"use client";

import { useState, useEffect, useRef } from 'react';
import { LevelData, Wall, Barrier, UnifiedPiston, Rect, Knife, Vector2, Color } from '@/game/types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, createLevel } from '@/game/Level';
import { FaPlay, FaSave, FaFolderOpen, FaTrash, FaUndo, FaMousePointer } from 'react-icons/fa';

type Tool = 
  | 'SELECT' 
  | 'DELETE' 
  | 'WALL' 
  | 'BARRIER' 
  | 'PISTON' 
  | 'START_POINT' 
  | 'KNIFE' 
  | 'FINISH_LINE';

type SelectionInfo = {
  type: 'wall' | 'barrier' | 'piston' | 'startPoint' | 'knife' | 'finishLine';
  index: number;
};

interface LevelEditorProps {
  onPlayTest: (levelData: LevelData) => void;
  onExit: () => void;
}

export default function LevelEditor({ onPlayTest, onExit }: LevelEditorProps) {
  const [levelData, setLevelData] = useState<LevelData>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bounce_arena_custom_level');
      if (saved) return JSON.parse(saved);
    }
    return createLevel();
  });

  const [tool, setTool] = useState<Tool>('SELECT');
  const [barrierColor, setBarrierColor] = useState<Color>('red');
  const [pistonType, setPistonType] = useState<UnifiedPiston['type']>('vertical');
  const [playerColor, setPlayerColor] = useState<Color>('red');
  
  const [gridSnap, setGridSnap] = useState(10);
  
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<Vector2 | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<Vector2 | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Helper to get scale factors for pointer events
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    
    let x = (e.clientX - rect.left) * scaleX;
    let y = (e.clientY - rect.top) * scaleY;
    
    if (gridSnap > 1) {
      x = Math.round(x / gridSnap) * gridSnap;
      y = Math.round(y / gridSnap) * gridSnap;
    }
    
    return { x, y };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    
    if (tool === 'SELECT' || tool === 'DELETE') {
      // Find what was clicked (reverse order to get top-most)
      let found: SelectionInfo | null = null;
      
      const checkRect = (r: Rect, type: SelectionInfo['type'], index: number) => {
        if (coords.x >= r.x && coords.x <= r.x + r.width && coords.y >= r.y && coords.y <= r.y + r.height) {
          found = { type, index };
          return true;
        }
        return false;
      };
      
      // Check Knives
      for (let i = levelData.knives.length - 1; i >= 0 && !found; i--) checkRect(levelData.knives[i], 'knife', i);
      // Check Finish Line
      if (!found) checkRect(levelData.finishLine, 'finishLine', 0);
      // Check Start Points
      for (let i = levelData.startPoints.length - 1; i >= 0 && !found; i--) {
        const pt = levelData.startPoints[i];
        if (pt && coords.x >= pt.x && coords.x <= pt.x + 30 && coords.y >= pt.y && coords.y <= pt.y + 30) {
          found = { type: 'startPoint', index: i };
        }
      }
      // Check Pistons
      for (let i = levelData.pistons.length - 1; i >= 0 && !found; i--) {
        const p = levelData.pistons[i];
        // For editor, draw pistons as a box of maxVal if width/height is 0
        const w = p.width || (p.type === 'vertical' ? 30 : p.maxVal);
        const h = p.height || (p.type === 'vertical' ? p.maxVal : 30);
        checkRect({x: p.x, y: p.y, width: w, height: h}, 'piston', i);
      }
      // Check Barriers
      for (let i = levelData.barriers.length - 1; i >= 0 && !found; i--) checkRect(levelData.barriers[i], 'barrier', i);
      // Check Walls
      for (let i = levelData.walls.length - 1; i >= 0 && !found; i--) checkRect(levelData.walls[i], 'wall', i);

      if (tool === 'DELETE' && found) {
        deleteObject(found);
      } else {
        setSelection(found);
      }
    } 
    else if (tool === 'START_POINT') {
      const idx = ['red', 'blue', 'green', 'yellow'].indexOf(playerColor);
      if (idx !== -1) {
        const newPts = [...levelData.startPoints];
        newPts[idx] = { x: coords.x, y: coords.y };
        setLevelData({ ...levelData, startPoints: newPts });
      }
    }
    else if (tool === 'KNIFE') {
      setLevelData({
        ...levelData,
        knives: [...levelData.knives, { id: `knife-${Date.now()}`, x: coords.x, y: coords.y, width: 30, height: 30, pickedUpBy: null }]
      });
    }
    else {
      // For WALL, BARRIER, PISTON, FINISH_LINE
      setIsDrawing(true);
      setDrawStart(coords);
      setDrawCurrent(coords);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setDrawCurrent(getCanvasCoords(e));
  };

  const handlePointerUp = () => {
    if (!isDrawing || !drawStart || !drawCurrent) return;
    setIsDrawing(false);
    
    const x = Math.min(drawStart.x, drawCurrent.x);
    const y = Math.min(drawStart.y, drawCurrent.y);
    let width = Math.abs(drawStart.x - drawCurrent.x);
    let height = Math.abs(drawStart.y - drawCurrent.y);
    
    if (width === 0 || height === 0) return; // Ignore zero-size rects

    if (tool === 'WALL') {
      setLevelData({ ...levelData, walls: [...levelData.walls, { x, y, width, height }] });
    } else if (tool === 'BARRIER') {
      setLevelData({ ...levelData, barriers: [...levelData.barriers, { id: `barrier-${Date.now()}`, color: barrierColor, x, y, width, height, isActive: true }] });
    } else if (tool === 'PISTON') {
      const maxVal = pistonType === 'vertical' ? height : width;
      const w = pistonType === 'vertical' ? width : 0;
      const h = pistonType === 'vertical' ? 0 : height;
      setLevelData({ ...levelData, pistons: [...levelData.pistons, { type: pistonType, x, y, width: w, height: h, maxVal, delay: 0 }] });
    } else if (tool === 'FINISH_LINE') {
      setLevelData({ ...levelData, finishLine: { x, y, width, height } });
    }
    
    setDrawStart(null);
    setDrawCurrent(null);
  };

  const deleteObject = (sel: SelectionInfo) => {
    const copy = { ...levelData };
    if (sel.type === 'wall') copy.walls.splice(sel.index, 1);
    if (sel.type === 'barrier') copy.barriers.splice(sel.index, 1);
    if (sel.type === 'piston') copy.pistons.splice(sel.index, 1);
    if (sel.type === 'knife') copy.knives.splice(sel.index, 1);
    // don't delete start points or finish line, they are required
    setLevelData(copy);
    setSelection(null);
  };

  // Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Grid
    if (gridSnap > 1) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= CANVAS_WIDTH; x += gridSnap) { ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_HEIGHT); }
      for (let y = 0; y <= CANVAS_HEIGHT; y += gridSnap) { ctx.moveTo(0, y); ctx.lineTo(CANVAS_WIDTH, y); }
      ctx.stroke();
    }

    // Helper for drawing selection outline
    const highlight = (rect: Rect) => {
      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(rect.x - 2, rect.y - 2, rect.width + 4, rect.height + 4);
      ctx.setLineDash([]);
    };

    // Draw Finish Line
    const fl = levelData.finishLine;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        ctx.fillStyle = (i + j) % 2 === 0 ? '#000' : '#fff';
        ctx.fillRect(fl.x + i * (fl.width / 4), fl.y + j * (fl.height / 4), fl.width / 4, fl.height / 4);
      }
    }
    if (selection?.type === 'finishLine') highlight(fl);

    // Draw Walls
    ctx.fillStyle = '#bdc3c7';
    levelData.walls.forEach((w, i) => {
      ctx.fillRect(w.x, w.y, w.width, w.height);
      ctx.strokeStyle = '#7f8c8d';
      ctx.lineWidth = 1;
      ctx.strokeRect(w.x, w.y, w.width, w.height);
      if (selection?.type === 'wall' && selection.index === i) highlight(w);
    });

    // Draw Barriers
    const getColorHex = (c: Color) => {
      if (c === 'red') return '#e74c3c';
      if (c === 'blue') return '#3498db';
      if (c === 'green') return '#2ecc71';
      if (c === 'yellow') return '#f1c40f';
      return '#2c3e50';
    };
    levelData.barriers.forEach((b, i) => {
      ctx.fillStyle = getColorHex(b.color);
      ctx.fillRect(b.x, b.y, b.width, b.height);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(b.x, b.y, b.width, b.height);
      if (selection?.type === 'barrier' && selection.index === i) highlight(b);
    });

    // Draw Pistons
    levelData.pistons.forEach((p, i) => {
      ctx.fillStyle = '#111827';
      const w = p.width || (p.type === 'vertical' ? 30 : p.maxVal);
      const h = p.height || (p.type === 'vertical' ? p.maxVal : 30);
      ctx.fillRect(p.x, p.y, w, h);
      ctx.strokeStyle = '#f39c12';
      ctx.strokeRect(p.x, p.y, w, h); // Outline to show max extent
      
      // Draw direction arrow
      ctx.fillStyle = '#f39c12';
      ctx.font = '20px sans-serif';
      ctx.fillText(p.type === 'vertical' ? '↓' : p.type === 'horizontal_left' ? '←' : '→', p.x + w/2 - 10, p.y + h/2 + 7);
      
      if (selection?.type === 'piston' && selection.index === i) highlight({x: p.x, y: p.y, width: w, height: h});
    });

    // Draw Knives
    const img = new Image();
    img.src = '/knife.png';
    levelData.knives.forEach((k, i) => {
      if (img.complete && img.naturalWidth) {
        ctx.save();
        ctx.translate(k.x + k.width/2, k.y + k.height/2);
        ctx.drawImage(img, -k.width, -k.height, k.width*2, k.height*2);
        ctx.restore();
      } else {
        ctx.fillStyle = '#aaa';
        ctx.fillRect(k.x, k.y, k.width, k.height);
      }
      if (selection?.type === 'knife' && selection.index === i) highlight(k);
    });

    // Draw Start Points
    const colors: Color[] = ['red', 'blue', 'green', 'yellow'];
    levelData.startPoints.forEach((pt, i) => {
      if (!pt) return;
      ctx.fillStyle = getColorHex(colors[i]);
      ctx.beginPath();
      ctx.arc(pt.x + 15, pt.y + 15, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText('P' + (i+1), pt.x + 5, pt.y + 20);
      if (selection?.type === 'startPoint' && selection.index === i) highlight({x: pt.x, y: pt.y, width: 30, height: 30});
    });

    // Draw active drawing rect
    if (isDrawing && drawStart && drawCurrent) {
      const x = Math.min(drawStart.x, drawCurrent.x);
      const y = Math.min(drawStart.y, drawCurrent.y);
      let width = Math.abs(drawStart.x - drawCurrent.x);
      let height = Math.abs(drawStart.y - drawCurrent.y);
      
      ctx.fillStyle = 'rgba(52, 152, 219, 0.4)';
      ctx.strokeStyle = '#3498db';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.fillRect(x, y, width, height);
      ctx.strokeRect(x, y, width, height);
      ctx.setLineDash([]);
    }

  }, [levelData, gridSnap, selection, isDrawing, drawStart, drawCurrent]);

  const saveToLocal = () => {
    localStorage.setItem('bounce_arena_custom_level', JSON.stringify(levelData));
    alert('Level saved to local storage!');
  };
  
  const resetLevel = () => {
    if (confirm('Reset to default game level?')) {
      setLevelData(createLevel());
      setSelection(null);
    }
  };

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', background: '#2c3e50', color: '#ecf0f1', fontFamily: 'sans-serif' }}>
      
      {/* Sidebar Toolbar */}
      <div style={{ width: '280px', background: '#1a252f', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
        <h2 style={{ margin: 0, color: '#3498db' }}>LEVEL EDITOR</h2>
        
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={() => onPlayTest(levelData)} style={btnStyle('#2ecc71')}><FaPlay /> Play</button>
          <button onClick={saveToLocal} style={btnStyle('#3498db')}><FaSave /> Save</button>
          <button onClick={resetLevel} style={btnStyle('#e74c3c')}><FaUndo /> Reset</button>
          <button onClick={onExit} style={btnStyle('#95a5a6')}>Exit</button>
        </div>

        <div style={{ borderTop: '1px solid #34495e', margin: '10px 0' }} />

        <div>
          <label style={{ display: 'block', marginBottom: '8px' }}>Tools:</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <ToolBtn toolName="SELECT" activeTool={tool} setTool={setTool}>Select / Edit</ToolBtn>
            <ToolBtn toolName="DELETE" activeTool={tool} setTool={setTool}>Delete (Click)</ToolBtn>
            <ToolBtn toolName="WALL" activeTool={tool} setTool={setTool}>Draw Wall</ToolBtn>
            <ToolBtn toolName="FINISH_LINE" activeTool={tool} setTool={setTool}>Draw Finish Line</ToolBtn>
            <ToolBtn toolName="KNIFE" activeTool={tool} setTool={setTool}>Place Knife</ToolBtn>
            
            <ToolBtn toolName="BARRIER" activeTool={tool} setTool={setTool}>Draw Barrier</ToolBtn>
            {tool === 'BARRIER' && (
              <select value={barrierColor} onChange={e => setBarrierColor(e.target.value as Color)} style={inputStyle}>
                <option value="red">Red</option>
                <option value="blue">Blue</option>
                <option value="green">Green</option>
                <option value="yellow">Yellow</option>
                <option value="black">Black</option>
              </select>
            )}

            <ToolBtn toolName="PISTON" activeTool={tool} setTool={setTool}>Draw Piston</ToolBtn>
            {tool === 'PISTON' && (
              <select value={pistonType} onChange={e => setPistonType(e.target.value as UnifiedPiston['type'])} style={inputStyle}>
                <option value="vertical">Vertical</option>
                <option value="horizontal_right">Horizontal Right</option>
                <option value="horizontal_left">Horizontal Left</option>
              </select>
            )}

            <ToolBtn toolName="START_POINT" activeTool={tool} setTool={setTool}>Place Start Point</ToolBtn>
            {tool === 'START_POINT' && (
              <select value={playerColor} onChange={e => setPlayerColor(e.target.value as Color)} style={inputStyle}>
                <option value="red">Red Player</option>
                <option value="blue">Blue Player</option>
                <option value="green">Green Player</option>
                <option value="yellow">Yellow Player</option>
              </select>
            )}
          </div>
        </div>

        <div style={{ borderTop: '1px solid #34495e', margin: '10px 0' }} />

        <div>
          <label style={{ display: 'block', marginBottom: '8px' }}>Grid Snap: {gridSnap}px</label>
          <input type="range" min="1" max="50" value={gridSnap} onChange={e => setGridSnap(Number(e.target.value))} style={{ width: '100%' }} />
        </div>

        {selection && selection.type === 'piston' && (
          <div style={{ background: '#34495e', padding: '10px', borderRadius: '4px' }}>
            <h4 style={{ margin: '0 0 10px 0' }}>Edit Piston</h4>
            <label style={{ fontSize: '12px' }}>Delay (seconds)</label>
            <input 
              type="number" 
              step="0.1"
              style={inputStyle}
              value={levelData.pistons[selection.index].delay}
              onChange={e => {
                const copy = [...levelData.pistons];
                copy[selection.index].delay = Number(e.target.value);
                setLevelData({ ...levelData, pistons: copy });
              }}
            />
          </div>
        )}
      </div>

      {/* Main Canvas Area */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', overflow: 'auto' }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          style={{
            background: '#d5d1c5',
            cursor: tool === 'SELECT' ? 'default' : tool === 'DELETE' ? 'crosshair' : 'crosshair',
            touchAction: 'none', /* Prevent scrolling while drawing on mobile/touch */
            height: '100%',
            maxHeight: '100%',
            width: 'auto',
            maxWidth: '100%',
            objectFit: 'contain'
          }}
        />
      </div>
    </div>
  );
}

const btnStyle = (color: string) => ({
  background: color,
  color: '#fff',
  border: 'none',
  padding: '8px 12px',
  borderRadius: '4px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontWeight: 'bold',
});

const inputStyle = {
  width: '100%',
  padding: '6px',
  marginTop: '4px',
  borderRadius: '4px',
  border: 'none',
  background: '#34495e',
  color: '#fff'
};

function ToolBtn({ toolName, activeTool, setTool, children }: { toolName: Tool, activeTool: Tool, setTool: (t: Tool) => void, children: React.ReactNode }) {
  const active = activeTool === toolName;
  return (
    <button
      onClick={() => setTool(toolName)}
      style={{
        background: active ? '#3498db' : '#34495e',
        color: '#fff',
        border: 'none',
        padding: '8px 12px',
        borderRadius: '4px',
        cursor: 'pointer',
        textAlign: 'left'
      }}
    >
      {children}
    </button>
  );
}
