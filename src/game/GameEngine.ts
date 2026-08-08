import { Player, Barrier, Wall, Rect, Color, Knife } from './types';
import { createLevel, CANVAS_WIDTH, CANVAS_HEIGHT } from './Level';

// Particle for block-break and death explosions
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;      // 0..1, fades out
  maxLife: number;
  size: number;
  color: string;
  rotation: number;
  rotSpeed: number;
}

// Ghost fragment for death animation
interface DeathFragment {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
  rotation: number;
  rotSpeed: number;
}

interface UnifiedPiston extends Rect {
  type: 'vertical' | 'horizontal_left' | 'horizontal_right';
  maxVal: number;
  delay: number;
  anchorX?: number; // Used to keep the right edge of left-sweeping pistons anchored
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private lastTime: number = 0;
  private animationId: number = 0;

  private players: Player[] = [];
  private walls: Wall[] = [];
  private barriers: Barrier[] = [];
  private particles: Particle[] = [];
  private deathFragments: DeathFragment[] = [];
  private scores: Record<string, number> = {};
  private knives: Knife[] = [];
  private finishLine: Rect;
  
  private playerColor: Color | null = null;
  private isPlaying: boolean = false;
  private animationFrameId: number | null = null;
  private knifeImg: HTMLImageElement;

  public onWin?: () => void;
  public onGameOver?: () => void;
  private audioCtx: AudioContext | null = null;
  private lastSoundTime: number = 0;
  
  private unifiedPistons: UnifiedPiston[] = [];
  private gameTime: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.knifeImg = new Image();
    this.knifeImg.src = '/knife.png';
    
    // Initialize level
    const level = createLevel();
    this.walls = level.walls;
    
    // Initialize unified cascading pistons (acts like a liquid snake)
    this.unifiedPistons = [];
    
    // Group 0: Chambers & Fillers (t=0)
    for (let i = 0; i < 4; i++) {
      this.unifiedPistons.push({
        type: 'vertical', x: level.startX + i * (level.chamberWidth + level.spacing),
        y: 150, width: level.chamberWidth, height: 0, maxVal: 130, delay: 0
      });
    }
    // Fill left gap (x=70 to 100)
    this.unifiedPistons.push({ type: 'vertical', x: 70, y: 150, width: 30, height: 0, maxVal: 130, delay: 0 });
    // Fill gap between chamber 3 and right drop (x=560 to 630)
    this.unifiedPistons.push({ type: 'vertical', x: 560, y: 150, width: 70, height: 0, maxVal: 130, delay: 0 });
    // Fill top of Right Gap (x=630 to 730)
    this.unifiedPistons.push({ type: 'vertical', x: 630, y: 150, width: 100, height: 0, maxVal: 130, delay: 0 });

    // Group 1: Floor 0 Sweep Right (Starts at 5.2s, sweeps from 70 to 630, height 120 to reach Floor 0)
    this.unifiedPistons.push({ type: 'horizontal_right', x: 70, y: 280, width: 0, height: 120, maxVal: 560, delay: 5.2 });

    // Group 2: Right Gap Floor 0 to 1 (Starts at 27.6s, pours from 280 down to Floor 1 ceiling at 420)
    this.unifiedPistons.push({ type: 'vertical', x: 630, y: 280, width: 100, height: 0, maxVal: 140, delay: 27.6 });

    // Group 3: Floor 1 Sweep Left (Starts at 33.2s, sweeps from right wall 730 left to 150)
    this.unifiedPistons.push({ type: 'horizontal_left', x: 730, y: 420, width: 0, height: 160, maxVal: 580, delay: 33.2, anchorX: 730 });

    // Group 4: Left Gap Floor 1 to 2 (Starts at 56.4s, pours from 420 down to Floor 2 ceiling at 600)
    this.unifiedPistons.push({ type: 'vertical', x: 70, y: 420, width: 80, height: 0, maxVal: 180, delay: 56.4 });

    // Group 5: Floor 2 Sweep Right (Starts at 63.6s, sweeps from left wall 70 right to 630)
    this.unifiedPistons.push({ type: 'horizontal_right', x: 70, y: 600, width: 0, height: 160, maxVal: 560, delay: 63.6 });

    // Group 6: Right Gap Floor 2 to 3 (Starts at 86.0s, pours from 600 down to Floor 3 ceiling at 780)
    this.unifiedPistons.push({ type: 'vertical', x: 630, y: 600, width: 100, height: 0, maxVal: 180, delay: 86.0 });

    // Group 7: Floor 3 Sweep Left (Starts at 93.2s, sweeps from right wall 730 left to 150)
    this.unifiedPistons.push({ type: 'horizontal_left', x: 730, y: 780, width: 0, height: 160, maxVal: 580, delay: 93.2, anchorX: 730 });
    
    this.barriers = level.barriers;
    this.finishLine = level.finishLine;

    // Initialize players and knives
    const colors: Color[] = ['red', 'blue', 'green', 'yellow'];
    for (let i = 0; i < 4; i++) {
      const cx = level.startX + i * (level.chamberWidth + level.spacing) + level.chamberWidth / 2;
      const cy = 150 + level.chamberHeight / 2;
      
      this.players.push({
        id: `player-${colors[i]}`,
        color: colors[i],
        x: cx - 15,
        y: cy - 15,
        width: 30,
        height: 30,
        velocity: { x: (Math.random() > 0.5 ? 1 : -1) * 150, y: (Math.random() > 0.5 ? 1 : -1) * 150 },
        hasKnife: false,
        speed: 150,
        isDead: false,
        deadTimer: 3.0,
        trail: [],
        squashX: 1,
        squashY: 1
      });
      this.scores[`player-${colors[i]}`] = 0;
    }
    
    // Add knife to grid slot 100 (Row 8, Col 2 -> X=100-150, Y=480-530)
    this.knives.push({
      id: `knife-100`,
      x: 110,
      y: 490, // Centered in slot 100
      width: 30,
      height: 30,
      pickedUpBy: null
    });
    
    // Draw initial state
    requestAnimationFrame(() => this.draw());
  }

  public startGame(selectedColor: Color) {
    this.playerColor = selectedColor;
    this.isPlaying = true;
    
    if (!this.audioCtx) {
      this.audioCtx = (window as any).globalAudioCtx || new (window.AudioContext || (window as any).webkitAudioContext)();
    } else if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  public stop() {
    this.isPlaying = false;
    cancelAnimationFrame(this.animationId);
  }

  private loop(timestamp: number) {
    if (!this.isPlaying) return;

    const deltaTime = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    this.update(deltaTime);
    this.draw();

    this.animationId = requestAnimationFrame((t) => this.loop(t));
  }

  private update(dt: number) {
    // Update particles (with gravity, rotation, and floor bounce)
    this.particles = this.particles.filter(p => p.life > 0);
    this.particles.forEach(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 800 * dt; // gravity
      p.rotation += p.rotSpeed * dt;
      
      // Floor bounce
      if (p.y + p.size > CANVAS_HEIGHT) {
        p.y = CANVAS_HEIGHT - p.size;
        p.vy *= -0.6; // bounciness
        p.vx *= 0.8;  // friction
      }
      
      p.life -= dt / p.maxLife;
    });

    // Update death fragments
    this.deathFragments = this.deathFragments.filter(f => f.life > 0);
    this.deathFragments.forEach(f => {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vy += 200 * dt;
      f.rotation += f.rotSpeed * dt;
      f.life -= dt * 1.5;
    });

    // Update unified cascading pistons
    if (this.isPlaying) {
      this.gameTime += dt;
      const speed = 25; // sweep speed
      this.unifiedPistons.forEach(p => {
        if (this.gameTime >= p.delay) {
          if (p.type === 'vertical') {
            if (p.height < p.maxVal) p.height += speed * dt;
            if (p.height > p.maxVal) p.height = p.maxVal;
          } else if (p.type === 'horizontal_left') {
            if (p.width < p.maxVal) p.width += speed * dt;
            if (p.width > p.maxVal) p.width = p.maxVal;
            p.x = p.anchorX! - p.width; // Keep right edge anchored
          } else if (p.type === 'horizontal_right') {
            if (p.width < p.maxVal) p.width += speed * dt;
            if (p.width > p.maxVal) p.width = p.maxVal;
          }
        }
      });
    }

    this.players.forEach(p => {
      if (p.isDead) {
        if (p.deadTimer > 0) {
          p.deadTimer -= dt;
          p.velocity.y += 800 * dt; // gravity applies to corpses
          p.y += p.velocity.y * dt;
          p.velocity.x = 0; // stop sliding
          this.walls.forEach(w => this.handleRectCollision(p, w));
        }
        return;
      }

      // Move player
      p.x += p.velocity.x * dt;
      p.y += p.velocity.y * dt;

      // Smoothly return to round shape
      p.squashX += (1 - p.squashX) * 15 * dt;
      p.squashY += (1 - p.squashY) * 15 * dt;

      // Update trail
      p.trail.push({ x: p.x + p.width / 2, y: p.y + p.height / 2 });
      if (p.trail.length > 15) {
        p.trail.shift();
      }

      // Wall collision
      this.walls.forEach(w => this.handleRectCollision(p, w));
      
      // Unified Piston collision
      this.unifiedPistons.forEach(piston => this.handleRectCollision(p, piston));

      // Barrier collision
      this.barriers.forEach(b => {
        if (!b.isActive) return;
        
        // If player matches barrier color OR barrier is black, destroy it
        if (this.checkAABB(p, b)) {
          this.handleRectCollision(p, b); // Always bounce off the door
          
          if (p.color === b.color || b.color === 'black') {
            b.isActive = false; // Destroy it after bouncing
            this.playSound('break');
            this.spawnBlockParticles(b);
            this.scores[p.id] = (this.scores[p.id] || 0) + 1;
          }
        }
      });

      // Canvas boundary collision (just in case they escape)
      if (p.x < 0) { p.x = 0; p.velocity.x *= -1; p.squashX = 0.6; p.squashY = 1.4; this.playSound('bounce'); }
      if (p.x + p.width > CANVAS_WIDTH) { p.x = CANVAS_WIDTH - p.width; p.velocity.x *= -1; p.squashX = 0.6; p.squashY = 1.4; this.playSound('bounce'); }
      if (p.y < 0) { p.y = 0; p.velocity.y *= -1; p.squashX = 1.4; p.squashY = 0.6; this.playSound('bounce'); }
      if (p.y + p.height > CANVAS_HEIGHT) { p.y = CANVAS_HEIGHT - p.height; p.velocity.y *= -1; p.squashX = 1.4; p.squashY = 0.6; this.playSound('bounce'); }

      // Knife pickup
      this.knives.forEach(k => {
        if (!k.pickedUpBy && this.checkAABB(p, k)) {
          k.pickedUpBy = p.id;
          p.hasKnife = true;
        }
      });

      // Finish line check
      if (this.checkAABB(p, this.finishLine)) {
        this.isPlaying = false;
        if (p.color === this.playerColor) {
          if (this.onWin) this.onWin();
        } else {
          // An AI won the race
          if (this.onGameOver) this.onGameOver();
        }
      }
    });

    // Player vs Player collision
    for (let i = 0; i < this.players.length; i++) {
      for (let j = i + 1; j < this.players.length; j++) {
        const p1 = this.players[i];
        const p2 = this.players[j];
        if (p1.isDead || p2.isDead) continue;

        if (this.checkAABB(p1, p2)) {
          // Combat logic
          if (p1.hasKnife && !p2.hasKnife) {
            p2.isDead = true;
            this.spawnDeathFragments(p2);
          } else if (p2.hasKnife && !p1.hasKnife) {
            p1.isDead = true;
            this.spawnDeathFragments(p1);
          } else {
            // Bounce off each other
            const tempX = p1.velocity.x;
            const tempY = p1.velocity.y;
            p1.velocity.x = p2.velocity.x;
            p1.velocity.y = p2.velocity.y;
            p2.velocity.x = tempX;
            p2.velocity.y = tempY;
            
            // Separate them slightly to avoid sticking
            p1.x += p1.velocity.x * dt;
            p1.y += p1.velocity.y * dt;
            
            p1.squashX = 0.7; p1.squashY = 1.3;
            p2.squashX = 0.7; p2.squashY = 1.3;
            
            this.playSound('bounce');
          }
        }
      }
    }

    // Check win/loss based on surviving players
    const alivePlayers = this.players.filter(p => !p.isDead);
    const deadPlayers = this.players.filter(p => p.isDead);
    const allCorpsesGone = deadPlayers.every(p => p.deadTimer <= 0);

    if (alivePlayers.length === 0 && allCorpsesGone) {
      // Everyone died
      this.isPlaying = false;
      if (this.onGameOver) this.onGameOver();
    } else if (alivePlayers.length === 1 && this.players.length > 1 && allCorpsesGone) {
      // Last man standing!
      this.isPlaying = false;
      const winner = alivePlayers[0];
      if (winner.color === this.playerColor) {
        if (this.onWin) this.onWin();
      } else {
        if (this.onGameOver) this.onGameOver();
      }
    }
  }

  private checkAABB(r1: Rect, r2: Rect) {
    return r1.x < r2.x + r2.width &&
           r1.x + r1.width > r2.x &&
           r1.y < r2.y + r2.height &&
           r1.y + r1.height > r2.y;
  }

  private handleRectCollision(p: Player, wall: Rect) {
    if (!this.checkAABB(p, wall)) return;

    // Determine which side we collided with
    const overlapLeft = (p.x + p.width) - wall.x;
    const overlapRight = (wall.x + wall.width) - p.x;
    const overlapTop = (p.y + p.height) - wall.y;
    const overlapBottom = (wall.y + wall.height) - p.y;

    const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

    if (minOverlap === overlapLeft) {
      p.x = wall.x - p.width;
      p.velocity.x *= -1;
      p.squashX = 0.6; p.squashY = 1.4;
    } else if (minOverlap === overlapRight) {
      p.x = wall.x + wall.width;
      p.velocity.x *= -1;
      p.squashX = 0.6; p.squashY = 1.4;
    } else if (minOverlap === overlapTop) {
      p.y = wall.y - p.height;
      p.velocity.y *= -1;
      p.squashX = 1.4; p.squashY = 0.6;
    } else if (minOverlap === overlapBottom) {
      p.y = wall.y + wall.height;
      p.velocity.y *= -1;
      p.squashX = 1.4; p.squashY = 0.6;
    }
    
    this.playSound('bounce');
  }

  private playSound(type: 'bounce' | 'break') {
    if (!this.audioCtx) return;
    
    const now = this.audioCtx.currentTime;
    
    // Throttle sounds to avoid audio overload/clipping
    if (now - this.lastSoundTime < 0.05) return;
    this.lastSoundTime = now;
    
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    
    // Add random pitch variation (detune) for satisfying juice
    const pitchShift = (Math.random() - 0.5) * 400; // Random shift up to +/- 200 cents
    osc.detune.value = pitchShift;
    
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    if (type === 'bounce') {
      osc.type = 'sine';
      // Slight randomization to base frequency too
      const baseFreq = 300 + Math.random() * 50;
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 2, now + 0.1);
      gain.gain.setValueAtTime(0.4, now); // Increased volume
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'break') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(150 + Math.random() * 50, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    }
  }

  private spawnBlockParticles(b: Barrier) {
    const hex = this.getColorHex(b.color);
    for (let i = 0; i < 14; i++) {
      const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.5;
      const speed = 80 + Math.random() * 180;
      this.particles.push({
        x: b.x + b.width / 2,
        y: b.y + b.height / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        life: 1,
        maxLife: 0.5 + Math.random() * 0.4,
        size: 3 + Math.random() * 5,
        color: hex,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 15
      });
    }
  }

  private spawnDeathFragments(p: Player) {
    const hex = this.getColorHex(p.color);
    for (let i = 0; i < 10; i++) {
      const angle = (Math.PI * 2 * i) / 10;
      const speed = 60 + Math.random() * 140;
      this.deathFragments.push({
        x: p.x + p.width / 2,
        y: p.y + p.height / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 80,
        life: 1,
        color: hex,
        size: 6 + Math.random() * 8,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 10
      });
    }
  }

  private draw() {
    this.ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Finish Line (Checkerboard)
    const fl = this.finishLine;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        this.ctx.fillStyle = (i + j) % 2 === 0 ? '#000' : '#fff';
        this.ctx.fillRect(fl.x + i * (fl.width / 4), fl.y + j * (fl.height / 4), fl.width / 4, fl.height / 4);
      }
    }

    // Draw Walls
    this.ctx.fillStyle = '#bdc3c7';
    this.walls.forEach(w => {
      this.ctx.fillRect(w.x, w.y, w.width, w.height);
      this.ctx.strokeStyle = '#7f8c8d';
      this.ctx.strokeRect(w.x, w.y, w.width, w.height);
    });
    
    // Draw Barriers
    this.barriers.forEach(b => {
      if (!b.isActive) return;
      this.ctx.fillStyle = this.getColorHex(b.color);
      this.ctx.fillRect(b.x, b.y, b.width, b.height);
      // Draw brick pattern
      this.ctx.strokeStyle = '#fff';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(b.x, b.y, b.width, b.height);
    });

    // Draw Unified Pistons
    this.unifiedPistons.forEach((piston, index) => {
      if (piston.height === 0 && piston.width === 0) return;
      
      this.ctx.fillStyle = '#111827';
      this.ctx.fillRect(piston.x, piston.y, piston.width, piston.height);

      // Draw Piston Number
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      this.ctx.font = 'bold 24px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(index.toString(), piston.x + piston.width / 2, piston.y + piston.height / 2);
    });



    // Draw Unpicked Knives
    this.knives.forEach(k => {
      if (!k.pickedUpBy) {
        this.drawKnife(k.x, k.y, k.width, k.height);
      }
    });

    // Draw Players and Trails
    this.players.forEach(p => {
      if (p.isDead) {
        if (p.deadTimer > 0) {
          // Draw corpse as a squished block of their original color
          this.ctx.fillStyle = this.getColorHex(p.color);
          this.ctx.globalAlpha = Math.max(0, p.deadTimer / 3.0);
          this.ctx.fillRect(p.x, p.y + p.height - 10, p.width, 10);
          this.ctx.globalAlpha = 1.0;
        }
        return;
      }

      // Draw Trail
      if (p.trail.length > 1) {
        this.ctx.beginPath();
        this.ctx.moveTo(p.trail[0].x, p.trail[0].y);
        for (let i = 1; i < p.trail.length; i++) {
          this.ctx.lineTo(p.trail[i].x, p.trail[i].y);
        }
        this.ctx.strokeStyle = this.getColorHex(p.color);
        this.ctx.lineWidth = p.width * 0.6;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.globalAlpha = 0.3;
        this.ctx.stroke();
        this.ctx.globalAlpha = 1.0;
      }

      // Draw glow (with Squash on Impact)
      const hex = this.getColorHex(p.color);
      
      this.ctx.save();
      // Translate to center of player
      const cx = p.x + p.width/2;
      const cy = p.y + p.height/2;
      this.ctx.translate(cx, cy);
      
      // Apply the current squash factors (will naturally be 1,1 unless just impacted)
      this.ctx.scale(p.squashX, p.squashY);
      
      this.ctx.shadowColor = hex;
      this.ctx.shadowBlur = 18;
      this.ctx.fillStyle = hex;
      // Draw relative to center (as a circle)
      this.ctx.beginPath();
      this.ctx.arc(0, 0, p.width/2, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
      
      // Draw eyes or marker for the player
      if (p.color === this.playerColor) {
        this.ctx.fillStyle = '#fff';
        this.ctx.beginPath();
        this.ctx.arc(p.x + p.width/2, p.y + p.height/2, 5, 0, Math.PI * 2);
        this.ctx.fill();
      }

      if (p.hasKnife) {
        this.drawKnife(p.x + p.width/2 - 10, p.y - 15, 20, 20);
      }
    });

    // Draw particles (square chunks rotating and shrinking)
    this.particles.forEach(pt => {
      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, pt.life);
      this.ctx.translate(pt.x, pt.y);
      this.ctx.rotate(pt.rotation);
      
      // Shrink over time based on life
      const currentSize = pt.size * Math.max(0.1, pt.life);
      
      this.ctx.fillStyle = pt.color;
      this.ctx.shadowColor = pt.color;
      this.ctx.shadowBlur = 8;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, currentSize/2, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    });

    // Draw death fragments
    this.deathFragments.forEach(f => {
      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, f.life);
      this.ctx.translate(f.x, f.y);
      this.ctx.rotate(f.rotation);
      this.ctx.fillStyle = f.color;
      this.ctx.shadowColor = f.color;
      this.ctx.shadowBlur = 10;
      this.ctx.fillRect(-f.size / 2, -f.size / 2, f.size, f.size);
      this.ctx.restore();
    });

    // --- DEBUG GRID (Squares with numbers) ---
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)'; // Darker grid lines
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';   // Darker text
    this.ctx.font = 'bold 12px sans-serif';      // Smaller text for smaller squares
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.lineWidth = 1;
    
    const gridSize = 50;
    let squareNumber = 1;
    
    const startX = 50;
    const endX = 750;
    const startY = 130;
    const endY = 1130;
    
    for (let y = startY; y < endY; y += gridSize) {
      for (let x = startX; x < endX; x += gridSize) {
        this.ctx.strokeRect(x, y, gridSize, gridSize);
        this.ctx.fillText(`${squareNumber}`, x + gridSize / 2, y + gridSize / 2);
        squareNumber++;
      }
    }
    this.ctx.restore();
  }

  private drawKnife(x: number, y: number, w: number, h: number) {
    this.ctx.save();
    this.ctx.translate(x + w/2, y + h/2);
    // The image itself is slanted in the user's provided file
    if (this.knifeImg.complete && this.knifeImg.naturalWidth > 0) {
      this.ctx.drawImage(this.knifeImg, -w, -h, w*2, h*2); // Doubling size to make it pop!
    }
    this.ctx.restore();
  }

  private getColorHex(color: Color) {
    switch (color) {
      case 'red': return '#e74c3c';
      case 'blue': return '#3498db';
      case 'green': return '#2ecc71';
      case 'yellow': return '#f1c40f';
      case 'black': return '#2c3e50';
      default: return '#fff';
    }
  }
}
