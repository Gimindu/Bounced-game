"use client";

import { useState } from "react";
import GameCanvas from "@/components/GameCanvas";
import { Color, GameState } from "@/game/types";
import { GiKnifeFork, GiFinishLine } from "react-icons/gi";
import { FaCircle, FaSkull, FaTrophy, FaRedo } from "react-icons/fa";

const COLOR_CONFIG: { color: Color; hex: string; label: string; btnClass: string }[] = [
  { color: "red",    hex: "#ff3b3b", label: "RED",    btnClass: "btn-red" },
  { color: "blue",   hex: "#3b8fff", label: "BLUE",   btnClass: "btn-blue" },
  { color: "green",  hex: "#3bff7a", label: "GREEN",  btnClass: "btn-green" },
  { color: "yellow", hex: "#ffe03b", label: "YELLOW", btnClass: "btn-yellow" },
];

export default function Home() {
  const [gameState, setGameState] = useState<GameState>("START");
  const [selectedColor, setSelectedColor] = useState<Color | null>(null);
  const [hoveredColor, setHoveredColor] = useState<Color | null>(null);

  const handleColorSelect = (color: Color) => {
    // Unlock audio context on user gesture
    let ctx = (window as any).globalAudioCtx;
    if (!ctx) {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      (window as any).globalAudioCtx = ctx;
    }
    if (ctx.state === "suspended") ctx.resume();
    
    // Force unlock for strict browsers by playing a silent sound
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.01);

    setSelectedColor(color);
    setGameState("PLAYING");
  };

  const handlePlayAgain = () => {
    setSelectedColor(null);
    setGameState("START");
  };

  return (
    <main style={{
      position: "relative", zIndex: 1,
      display: "flex", flexDirection: "row",
      alignItems: "center", justifyContent: "center",
      width: "100vw", height: "100vh",
      gap: "24px", padding: "16px",
      overflow: "hidden",
    }}>

      {/* LEFT SIDEBAR */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "28px", minWidth: "240px", flex: "0 0 240px" }}>
        
        {/* Title */}
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "4px" }}>
            <FaCircle style={{ color: "#3b8fff", fontSize: "2rem", filter: "drop-shadow(0 0 10px #3b8fff)" }} />
            <h1 className="neon-title flicker" style={{ fontSize: "2.2rem", fontWeight: 900, color: "#3b8fff", letterSpacing: "0.1em" }}>
              BOUNCE
            </h1>
          </div>
          <h1 className="neon-title" style={{ fontSize: "2.2rem", fontWeight: 900, color: "#3b8fff", letterSpacing: "0.1em" }}>
            ARENA
          </h1>
          <p style={{ color: "#6080a0", fontSize: "0.85rem", letterSpacing: "0.15em", marginTop: "8px", fontFamily: "Orbitron, sans-serif" }}>
            BREAK &bull; RACE &bull; SURVIVE
          </p>
        </div>

        {/* Color picker */}
        {gameState === "START" && (
          <div className="slide-up" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
            <p style={{ color: "#8899bb", fontSize: "0.85rem", letterSpacing: "0.2em", fontFamily: "Orbitron, sans-serif", textAlign: "center" }}>
              CHOOSE YOUR<br />CIRCLE
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {COLOR_CONFIG.map(({ color, hex, label, btnClass }) => (
                <button
                  key={color}
                  className={btnClass}
                  onClick={() => handleColorSelect(color)}
                  onMouseEnter={() => setHoveredColor(color)}
                  onMouseLeave={() => setHoveredColor(null)}
                  style={{
                    width: "200px", height: "56px",
                    borderRadius: "10px",
                    backgroundColor: hex,
                    border: hoveredColor === color ? "2px solid #fff" : "2px solid transparent",
                    cursor: "pointer",
                    transform: hoveredColor === color ? "scale(1.06) translateX(5px)" : "scale(1)",
                    transition: "transform 0.2s cubic-bezier(0.34,1.56,0.64,1), border 0.15s",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "12px",
                  }}
                  aria-label={`Select ${color}`}
                >
                  <FaCircle style={{ fontSize: "1.4rem", color: "rgba(0,0,0,0.45)" }} />
                  <span style={{ color: "rgba(0,0,0,0.8)", fontSize: "1rem", fontFamily: "Orbitron, sans-serif", fontWeight: 700 }}>{label}</span>
                </button>
              ))}
            </div>
            <p style={{ color: "#445566", fontSize: "0.75rem", marginTop: "4px", letterSpacing: "0.08em", textAlign: "center" }}>
              Bounces auto &mdash; just survive!
            </p>
          </div>
        )}

        {/* Legend */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", opacity: 0.6, fontSize: "0.8rem", letterSpacing: "0.08em", color: "#6080a0", fontFamily: "Orbitron, sans-serif" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "10px" }}><FaCircle style={{ color: "#6080a0", fontSize: "1rem" }} /> BREAK DOORS</span>
          <span style={{ display: "flex", alignItems: "center", gap: "10px" }}><GiKnifeFork style={{ color: "#6080a0", fontSize: "1.1rem" }} /> GRAB KNIFE</span>
          <span style={{ display: "flex", alignItems: "center", gap: "10px" }}><GiFinishLine style={{ color: "#6080a0", fontSize: "1.1rem" }} /> REACH FINISH</span>
        </div>
      </div>


      {/* CANVAS + overlays */}
      <div className="scanlines" style={{ position: "relative", height: "100%", flex: "1 1 auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <GameCanvas
          isPlaying={gameState === "PLAYING"}
          selectedColor={selectedColor}
          onGameOver={() => setGameState("GAME_OVER")}
          onWin={() => setGameState("WIN")}
        />

        {/* GAME OVER Overlay */}
        {gameState === "GAME_OVER" && (
          <div
            className="slide-up"
            style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              background: "rgba(10,10,20,0.88)",
              backdropFilter: "blur(6px)",
              borderRadius: "12px",
              zIndex: 20, gap: "24px",
            }}
          >
            <div>
              <h2 className="neon-title" style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "clamp(1.8rem, 5vw, 3rem)", fontWeight: 900, color: "#ff3b3b", textAlign: "center" }}>
                <FaSkull /> ELIMINATED
              </h2>
              <p style={{ color: "#664444", textAlign: "center", fontSize: "0.7rem", letterSpacing: "0.2em", marginTop: "8px", fontFamily: "Orbitron, sans-serif" }}>
                YOU HAVE BEEN DEFEATED
              </p>
            </div>
            <button
              onClick={handlePlayAgain}
              style={{
                padding: "12px 36px", background: "transparent",
                border: "2px solid #ff3b3b", borderRadius: "50px",
                color: "#ff3b3b", fontFamily: "Orbitron, sans-serif",
                fontWeight: 700, fontSize: "0.85rem", letterSpacing: "0.15em",
                cursor: "pointer", boxShadow: "0 0 20px rgba(255,59,59,0.4)", transition: "all 0.2s",
              }}
              onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = "#ff3b3b"; (e.target as HTMLButtonElement).style.color = "#000"; }}
              onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = "transparent"; (e.target as HTMLButtonElement).style.color = "#ff3b3b"; }}
            ><span style={{ display: "flex", alignItems: "center", gap: "8px" }}><FaRedo style={{ pointerEvents: 'none' }} /> <span style={{ pointerEvents: 'none' }}>TRY AGAIN</span></span></button>
          </div>
        )}

        {/* WIN Overlay */}
        {gameState === "WIN" && (
          <div
            className="slide-up"
            style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              background: "rgba(10,10,20,0.88)",
              backdropFilter: "blur(6px)",
              borderRadius: "12px",
              zIndex: 20, gap: "24px",
            }}
          >
            <div>
              <h2 className="neon-title" style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "clamp(1.8rem, 5vw, 3rem)", fontWeight: 900, color: "#3bff7a", textAlign: "center" }}>
                <FaTrophy /> VICTORY!
              </h2>
              <p style={{ color: "#336644", textAlign: "center", fontSize: "0.7rem", letterSpacing: "0.2em", marginTop: "8px", fontFamily: "Orbitron, sans-serif" }}>
                YOUR SQUARE REACHED THE FINISH
              </p>
            </div>
            <button
              onClick={handlePlayAgain}
              style={{
                padding: "12px 36px", background: "transparent",
                border: "2px solid #3bff7a", borderRadius: "50px",
                color: "#3bff7a", fontFamily: "Orbitron, sans-serif",
                fontWeight: 700, fontSize: "0.85rem", letterSpacing: "0.15em",
                cursor: "pointer", boxShadow: "0 0 20px rgba(59,255,122,0.4)", transition: "all 0.2s",
              }}
              onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = "#3bff7a"; (e.target as HTMLButtonElement).style.color = "#000"; }}
              onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = "transparent"; (e.target as HTMLButtonElement).style.color = "#3bff7a"; }}
            ><span style={{ display: "flex", alignItems: "center", gap: "8px" }}><FaRedo style={{ pointerEvents: 'none' }} /> <span style={{ pointerEvents: 'none' }}>PLAY AGAIN</span></span></button>
          </div>
        )}
      </div>
    </main>
  );
}
