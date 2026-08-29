"use client"

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react"
import { Play, ArrowLeft, ArrowRight, Lock, RotateCcw, Trophy, Volume2, VolumeX, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Types
export interface FruitNinjaGameRef {
  handleGestureSlice: (x: number, y: number) => void;
  triggerSwipeSlice: (direction: "left" | "right" | "random") => void;
}

type LevelConfig = {
  id: number;
  name: string;
  description: string;
  targetScore: number;
  spawnInterval: number;
  spawnCountMin: number;
  spawnCountMax: number;
  minSpeedY: number;
  maxSpeedY: number;
  gravity: number;
  fruitRadius: number;
  metaDesc: string;
}

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  life: number;
  active: boolean;
}

type FruitHalf = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotSpeed: number;
}

type Fruit = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  emoji: string;
  color: string;
  rotation: number;
  rotSpeed: number;
  isSliced: boolean;
  half1?: FruitHalf;
  half2?: FruitHalf;
}

type TrailPoint = {
  x: number;
  y: number;
  time: number;
}

type FloatingText = {
  id: string;
  x: number;
  y: number;
  text: string;
  alpha: number;
  scale: number;
  color: string;
}

// Distance from point (px, py) to line segment (x1, y1) -> (x2, y2)
function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

// Level configurations with ultra floaty low gravity and generous timing
const LEVELS: LevelConfig[] = [
  {
    id: 1,
    name: "Nivel 1: Iniciación",
    description: "Corte elemental. Frutas lentas con caída flotante suave.",
    targetScore: 15,
    spawnInterval: 3200,
    spawnCountMin: 1,
    spawnCountMax: 2,
    minSpeedY: -6.8,
    maxSpeedY: -5.4,
    gravity: 0.060,
    fruitRadius: 32,
    metaDesc: "Objetivo: Cortar 15 frutas"
  },
  {
    id: 2,
    name: "Nivel 2: Destreza",
    description: "Ascensos controlados y grupos pequeños de frutas flotantes.",
    targetScore: 30,
    spawnInterval: 2600,
    spawnCountMin: 2,
    spawnCountMax: 3,
    minSpeedY: -7.2,
    maxSpeedY: -5.8,
    gravity: 0.065,
    fruitRadius: 30,
    metaDesc: "Objetivo: Cortar 30 frutas"
  },
  {
    id: 3,
    name: "Nivel 3: Precisión",
    description: "Objetivos estilizados de trayectoria suave en arco.",
    targetScore: 45,
    spawnInterval: 2200,
    spawnCountMin: 2,
    spawnCountMax: 4,
    minSpeedY: -7.6,
    maxSpeedY: -6.2,
    gravity: 0.070,
    fruitRadius: 28,
    metaDesc: "Objetivo: Cortar 45 frutas"
  },
  {
    id: 4,
    name: "Nivel 4: Velocidad",
    description: "Ráfagas rítmicas para entrenar la rapidez del movimiento gestual.",
    targetScore: 60,
    spawnInterval: 1800,
    spawnCountMin: 3,
    spawnCountMax: 4,
    minSpeedY: -8.0,
    maxSpeedY: -6.5,
    gravity: 0.075,
    fruitRadius: 28,
    metaDesc: "Objetivo: Cortar 60 frutas"
  },
  {
    id: 5,
    name: "Nivel 5: Modo Frenesí",
    description: "Lluvia de frutas flotantes en cascada suave.",
    targetScore: 80,
    spawnInterval: 1400,
    spawnCountMin: 3,
    spawnCountMax: 5,
    minSpeedY: -8.4,
    maxSpeedY: -6.8,
    gravity: 0.078,
    fruitRadius: 29,
    metaDesc: "Objetivo: Cortar 80 frutas"
  },
  {
    id: 6,
    name: "Modo Zen Infinito",
    description: "Sin fin de frutas y con vidas infinitas. Corta a tu propio ritmo.",
    targetScore: 0,
    spawnInterval: 2200,
    spawnCountMin: 2,
    spawnCountMax: 4,
    minSpeedY: -7.4,
    maxSpeedY: -5.8,
    gravity: 0.065,
    fruitRadius: 30,
    metaDesc: "Objetivo: Puntuación récord con vidas infinitas"
  }
];

const FRUIT_EMOJIS = [
  { emoji: "🍉", color: "#f87171" },
  { emoji: "🍎", color: "#ef4444" },
  { emoji: "🍊", color: "#f97316" },
  { emoji: "🍓", color: "#f43f5e" },
  { emoji: "🍌", color: "#eab308" }
];

// Lightweight Sound Synthesizer
class SoundSynth {
  private ctx: AudioContext | null = null;
  public isMuted: boolean = false;
  private activeVoices: number = 0;

  private init() {
    if (this.isMuted) return;
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  private playWithThrottle(playFn: () => void, durationMs: number) {
    this.init();
    if (!this.ctx || this.isMuted) return;
    if (this.activeVoices >= 3) return;
    this.activeVoices++;
    try {
      playFn();
    } catch (e) {
      console.warn(e);
    }
    setTimeout(() => {
      this.activeVoices = Math.max(0, this.activeVoices - 1);
    }, durationMs);
  }

  playWhoosh() {
    this.playWithThrottle(() => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(60, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.12);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(200, this.ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.10, this.ctx.currentTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

      osc.start(this.ctx.currentTime);
      osc.stop(this.ctx.currentTime + 0.12);
    }, 120);
  }

  playSquish() {
    this.playWithThrottle(() => {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.06);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = buffer;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = "bandpass";
      noiseFilter.frequency.setValueAtTime(800, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(120, now + 0.06);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.18, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);

      noiseSource.start(now);
      noiseSource.stop(now + 0.06);
    }, 80);
  }

  playCombo(count: number) {
    this.playWithThrottle(() => {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const baseFreq = 440;
      const intervals = [0, 3, 7, 10, 12];

      for (let i = 0; i < Math.min(count, 5); i++) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = "sine";
        const factor = Math.pow(2, (intervals[i] || 12) / 12);
        const freq = baseFreq * factor;
        const timeOffset = i * 0.06;

        osc.frequency.setValueAtTime(freq, now + timeOffset);
        gain.gain.setValueAtTime(0.001, now + timeOffset);
        gain.gain.linearRampToValueAtTime(0.06, now + timeOffset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + 0.18);

        osc.start(now + timeOffset);
        osc.stop(now + timeOffset + 0.18);
      }
    }, 180 + count * 60);
  }
}

const audioSynth = new SoundSynth();

export const FruitNinjaGame = forwardRef<FruitNinjaGameRef, { onGestureSlice?: (gestureId: any) => void; onExitGame?: () => void }>(
  ({ onGestureSlice, onExitGame }, ref) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [activeLevel, setActiveLevel] = useState<LevelConfig | null>(null);
    const [activeSlide, setActiveSlide] = useState(0);
    const [score, setScore] = useState(0);
    const [highScore, setHighScore] = useState(0);
    const [gameResult, setGameResult] = useState<"win" | null>(null);
    const [completedLevels, setCompletedLevels] = useState<number[]>([]);
    const [isMuted, setIsMuted] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    // Pre-allocated object pool of 50 particles for zero GC lag
    const preallocatedParticles = Array.from({ length: 50 }, () => ({
      x: 0, y: 0, vx: 0, vy: 0, radius: 0, color: "", alpha: 0, life: 0, active: false
    })) as Particle[];

    // Game loop mutable states
    const stateRef = useRef({
      fruits: [] as Fruit[],
      particles: preallocatedParticles,
      trail: [] as TrailPoint[],
      floatingTexts: [] as FloatingText[],
      score: 0,
      slicedInStrokeCount: 0,
      lastStrokeTime: 0,
      lastPoint: null as { x: number; y: number } | null,
      levelTarget: 15,
      isInfinite: false,
      gameActive: false,
      lastScoreSync: 0,

      // Scaler parameters for true letterbox scaling
      scale: 1,
      offsetX: 0,
      offsetY: 0
    });

    useEffect(() => {
      if (typeof window !== "undefined") {
        const savedLevels = localStorage.getItem("ademan_ninja_completed_levels");
        if (savedLevels) {
          try {
            setCompletedLevels(JSON.parse(savedLevels));
          } catch (e) {
            console.error(e);
          }
        }
        const savedRecord = localStorage.getItem("ademan_ninja_record");
        if (savedRecord) {
          setHighScore(parseInt(savedRecord, 10));
        }
        const savedMute = localStorage.getItem("ademan_ninja_muted");
        if (savedMute) {
          const muteValue = savedMute === "true";
          setIsMuted(muteValue);
          audioSynth.isMuted = muteValue;
        }
      }
    }, []);

    useEffect(() => {
      window.addEventListener("resize", resizeCanvas);
      return () => {
        window.removeEventListener("resize", resizeCanvas);
      };
    }, []);

    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const w = container.clientWidth;
      const h = container.clientHeight;
      canvas.width = w;
      canvas.height = h;

      const targetAspect = 8 / 5;
      let scale = 1;
      let offsetX = 0;
      let offsetY = 0;

      if (w / h > targetAspect) {
        scale = h / 500;
        offsetX = (w - 800 * scale) / 2;
      } else {
        scale = w / 800;
        offsetY = (h - 500 * scale) / 2;
      }

      stateRef.current.scale = scale;
      stateRef.current.offsetX = offsetX;
      stateRef.current.offsetY = offsetY;
    };

    const toggleMute = () => {
      const nextMute = !isMuted;
      setIsMuted(nextMute);
      audioSynth.isMuted = nextMute;
      if (typeof window !== "undefined") {
        localStorage.setItem("ademan_ninja_muted", String(nextMute));
      }
    };

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (isPlaying) return;
        if (e.key === "ArrowLeft") {
          setActiveSlide((prev) => Math.max(0, prev - 1));
        } else if (e.key === "ArrowRight") {
          setActiveSlide((prev) => Math.min(LEVELS.length - 1, prev + 1));
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isPlaying]);

    // Expose slice functions
    useImperativeHandle(ref, () => ({
      handleGestureSlice: (x, y) => {
        if (!stateRef.current.gameActive) return;
        registerPoint(x, y);
      },
      triggerSwipeSlice: (direction) => {
        if (!stateRef.current.gameActive || !canvasRef.current) return;
        audioSynth.playWhoosh();
        const stepCount = 10;
        
        let startX = 0, startY = 0, endX = 0, endY = 0;
        if (direction === "left") {
          startX = 720; startY = 120;
          endX = 80; endY = 380;
        } else if (direction === "right") {
          startX = 80; startY = 120;
          endX = 720; endY = 380;
        } else {
          startX = Math.random() * 300 + 80;
          startY = Math.random() * 200 + 80;
          endX = startX + 380;
          endY = startY + 180;
        }

        let prevX = startX;
        let prevY = startY;
        stateRef.current.slicedInStrokeCount = 0;

        for (let i = 0; i <= stepCount; i++) {
          const t = i / stepCount;
          const px = startX + (endX - startX) * t;
          const py = startY + (endY - startY) * t;
          stateRef.current.trail.push({ x: px, y: py, time: Date.now() });
          checkCollisions(px, py, prevX, prevY);
          prevX = px;
          prevY = py;
        }

        if (stateRef.current.slicedInStrokeCount > 1) {
          const comboNum = stateRef.current.slicedInStrokeCount;
          audioSynth.playCombo(comboNum);
          
          const midX = (startX + endX) / 2;
          const midY = (startY + endY) / 2;
          stateRef.current.floatingTexts.push({
            id: crypto.randomUUID(),
            x: midX,
            y: midY - 20,
            text: `Combo x${comboNum}`,
            alpha: 1,
            scale: 1.2,
            color: "#ffffff"
          });
        }
      }
    }));

    const registerPoint = (x: number, y: number) => {
      const now = Date.now();
      const state = stateRef.current;
      
      if (now - state.lastStrokeTime > 220) {
        if (state.slicedInStrokeCount > 1) {
          const count = state.slicedInStrokeCount;
          audioSynth.playCombo(count);
          if (state.trail.length > 2) {
            const mid = state.trail[Math.floor(state.trail.length / 2)];
            state.floatingTexts.push({
              id: crypto.randomUUID(),
              x: mid.x,
              y: mid.y - 20,
              text: `Combo x${count}`,
              alpha: 1,
              scale: 1.2,
              color: "#ffffff"
            });
          }
        }
        state.slicedInStrokeCount = 0;
        state.lastPoint = null;
        audioSynth.playWhoosh();
      }

      state.trail.push({ x, y, time: now });
      if (state.trail.length > 10) {
        state.trail.shift();
      }
      state.lastStrokeTime = now;

      // Continuous line-segment collision with previous position for high precision
      checkCollisions(x, y, state.lastPoint?.x, state.lastPoint?.y);
      state.lastPoint = { x, y };
    };

    // Continuous line-segment to circle collision detection
    const checkCollisions = (x: number, y: number, prevX?: number, prevY?: number) => {
      const state = stateRef.current;
      state.fruits.forEach((fruit) => {
        if (fruit.isSliced) return;

        const dist = (prevX !== undefined && prevY !== undefined)
          ? distToSegment(fruit.x, fruit.y, prevX, prevY, x, y)
          : Math.hypot(fruit.x - x, fruit.y - y);

        // Generous slice hit radius (+28px) for effortless hand tracking cuts
        if (dist <= fruit.radius + 28) {
          fruit.isSliced = true;
          audioSynth.playSquish();
          state.slicedInStrokeCount++;

          // Halves velocity with soft float
          fruit.half1 = {
            x: fruit.x,
            y: fruit.y,
            vx: fruit.vx - 2.2,
            vy: fruit.vy - 0.8,
            rotation: fruit.rotation,
            rotSpeed: -fruit.rotSpeed - 0.04
          };
          fruit.half2 = {
            x: fruit.x,
            y: fruit.y,
            vx: fruit.vx + 2.2,
            vy: fruit.vy - 0.8,
            rotation: fruit.rotation,
            rotSpeed: fruit.rotSpeed + 0.04
          };

          // Re-use particles from pool (spawn max 5 per cut)
          let particlesSpawned = 0;
          for (let i = 0; i < state.particles.length; i++) {
            if (particlesSpawned >= 5) break;
            const p = state.particles[i];
            if (!p.active) {
              const angle = Math.random() * Math.PI * 2;
              const force = Math.random() * 2.8 + 1.5;
              p.x = fruit.x;
              p.y = fruit.y;
              p.vx = Math.cos(angle) * force;
              p.vy = Math.sin(angle) * force - 0.5;
              p.radius = Math.random() * 2.2 + 2;
              p.color = fruit.color;
              p.alpha = 1;
              p.life = 1.0;
              p.active = true;
              particlesSpawned++;
            }
          }

          // Floating score text
          if (state.floatingTexts.length < 10) {
            state.floatingTexts.push({
              id: crypto.randomUUID(),
              x: fruit.x,
              y: fruit.y - 10,
              text: "+1",
              alpha: 1,
              scale: 1,
              color: "#ffffff"
            });
          }

          // Update internal score
          state.score += 1;

          // Sync React state throttled or on win
          if (!state.isInfinite && state.score >= state.levelTarget) {
            setScore(state.score);
            handleGameWin();
          }
        }
      });
    };

    // Render loop and Delta-Time update
    useEffect(() => {
      if (!isPlaying || !activeLevel) return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Reset loop variables
      stateRef.current.score = 0;
      stateRef.current.levelTarget = activeLevel.targetScore;
      stateRef.current.isInfinite = activeLevel.id === 6;
      stateRef.current.fruits = [];
      stateRef.current.floatingTexts = [];
      stateRef.current.gameActive = true;
      stateRef.current.slicedInStrokeCount = 0;
      stateRef.current.lastPoint = null;

      stateRef.current.particles.forEach((p) => {
        p.active = false;
      });

      setScore(0);
      setGameResult(null);

      // Trigger dynamic scale measurements
      setTimeout(() => resizeCanvas(), 30);

      let animFrameId: number;
      let spawnerTimerId: NodeJS.Timeout;
      let lastTime = performance.now();

      // Periodic fruit spawner
      const spawnFruit = () => {
        if (!stateRef.current.gameActive) return;
        const count = Math.floor(
          Math.random() * (activeLevel.spawnCountMax - activeLevel.spawnCountMin + 1) +
            activeLevel.spawnCountMin
        );

        for (let i = 0; i < count; i++) {
          const rx = Math.random() * 520 + 140;
          const ry = 525; // launch from bottom

          const targetX = 400 + (Math.random() * 240 - 120);
          const flightTime = Math.random() * 40 + 55;
          const vx = (targetX - rx) / flightTime;
          const vy = Math.random() * (activeLevel.maxSpeedY - activeLevel.minSpeedY) + activeLevel.minSpeedY;
          
          const selection = FRUIT_EMOJIS[Math.floor(Math.random() * FRUIT_EMOJIS.length)];

          stateRef.current.fruits.push({
            id: crypto.randomUUID(),
            x: rx,
            y: ry,
            vx,
            vy,
            radius: activeLevel.fruitRadius,
            emoji: selection.emoji,
            color: selection.color,
            rotation: Math.random() * Math.PI,
            rotSpeed: Math.random() * 0.05 - 0.025,
            isSliced: false
          });
        }

        const nextTime = activeLevel.spawnInterval * (Math.random() * 0.35 + 0.85);
        spawnerTimerId = setTimeout(spawnFruit, nextTime);
      };

      spawnerTimerId = setTimeout(spawnFruit, 600);

      // Render Frame Callback
      const render = (time: number) => {
        const dt = Math.min(2.5, (time - lastTime) / 16.666);
        lastTime = time;

        const state = stateRef.current;

        // Clear Canvas Buffer
        ctx.fillStyle = "#09090b";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Scale and translate rendering context
        ctx.save();
        ctx.translate(state.offsetX, state.offsetY);
        ctx.scale(state.scale, state.scale);

        // Background tactical grid
        ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
        ctx.lineWidth = 1;
        const gridSize = 40;
        for (let x = 0; x < 800; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, 500);
          ctx.stroke();
        }
        for (let y = 0; y < 500; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(800, y);
          ctx.stroke();
        }

        // 1. Update and Render Particles
        state.particles.forEach((p) => {
          if (!p.active) return;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 0.08 * dt; // gentle floaty particle gravity
          p.life -= 0.020 * dt;
          p.alpha = Math.max(0, p.life);

          if (p.life <= 0 || p.alpha < 0.05 || p.y > 520) {
            p.active = false;
            return;
          }

          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });

        // 2. Update and Render Fruits (Infinite lives: dropped fruits never cause game over!)
        state.fruits = state.fruits.filter((fruit) => {
          if (!fruit.isSliced) {
            fruit.x += fruit.vx * dt;
            fruit.y += fruit.vy * dt;
            fruit.vy += activeLevel.gravity * dt; // soft low gravity
            fruit.rotation += fruit.rotSpeed * dt;

            ctx.save();
            ctx.translate(fruit.x, fruit.y);
            ctx.rotate(fruit.rotation);
            ctx.font = `bold ${fruit.radius * 2}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(fruit.emoji, 0, 0);
            ctx.restore();

            // Offscreen: cleanly delete fruit without losing lives
            return !(fruit.y > 560 && fruit.vy > 0);
          } else {
            // Sliced halves movement
            const h1 = fruit.half1!;
            const h2 = fruit.half2!;

            h1.x += h1.vx * dt;
            h1.y += h1.vy * dt;
            h1.vy += (activeLevel.gravity + 0.04) * dt;
            h1.rotation += h1.rotSpeed * dt;

            h2.x += h2.vx * dt;
            h2.y += h2.vy * dt;
            h2.vy += (activeLevel.gravity + 0.04) * dt;
            h2.rotation += h2.rotSpeed * dt;

            // Draw half 1 (left)
            ctx.save();
            ctx.translate(h1.x, h1.y);
            ctx.rotate(h1.rotation);
            ctx.beginPath();
            ctx.rect(-fruit.radius, -fruit.radius, fruit.radius, fruit.radius * 2);
            ctx.clip();
            ctx.font = `bold ${fruit.radius * 2}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(fruit.emoji, 0, 0);
            ctx.restore();

            // Draw half 2 (right)
            ctx.save();
            ctx.translate(h2.x, h2.y);
            ctx.rotate(h2.rotation);
            ctx.beginPath();
            ctx.rect(0, -fruit.radius, fruit.radius, fruit.radius * 2);
            ctx.clip();
            ctx.font = `bold ${fruit.radius * 2}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(fruit.emoji, 0, 0);
            ctx.restore();

            return h1.y < 540 && h2.y < 540;
          }
        });

        // 3. Render Blade Trail (Optimized: No slow shadow blurs)
        const now = Date.now();
        state.trail = state.trail.filter((pt) => now - pt.time < 130);

        if (state.trail.length > 1) {
          ctx.save();
          ctx.lineCap = "round";
          ctx.lineJoin = "round";

          // Glow stroke
          for (let i = 1; i < state.trail.length; i++) {
            const p1 = state.trail[i - 1];
            const p2 = state.trail[i];
            const age = now - p2.time;
            const ratio = Math.max(0, 1 - age / 130);

            ctx.strokeStyle = `rgba(255, 255, 255, ${ratio * 0.25})`;
            ctx.lineWidth = ratio * 15;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }

          // Core stroke
          for (let i = 1; i < state.trail.length; i++) {
            const p1 = state.trail[i - 1];
            const p2 = state.trail[i];
            const age = now - p2.time;
            const ratio = Math.max(0, 1 - age / 130);

            ctx.strokeStyle = `rgba(255, 255, 255, ${ratio * 0.95})`;
            ctx.lineWidth = ratio * 5;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
          ctx.restore();
        }

        // 4. Update and Render Floating Texts
        state.floatingTexts = state.floatingTexts.filter((t) => {
          t.y -= 1.0 * dt;
          t.alpha -= 0.022 * dt;

          ctx.save();
          ctx.globalAlpha = Math.max(0, t.alpha);
          ctx.fillStyle = t.color;
          ctx.font = `bold ${Math.round(18 * t.scale)}px monospace`;
          ctx.textAlign = "center";
          ctx.fillText(t.text, t.x, t.y);
          ctx.restore();

          return t.alpha > 0;
        });

        // 5. Render Canvas Native HUD (Zero React re-render overhead!)
        // Score (Top Left)
        ctx.save();
        ctx.fillStyle = "#a1a1aa";
        ctx.font = "10px monospace";
        ctx.fillText("PUNTUACIÓN", 20, 24);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 24px monospace";
        ctx.fillText(`${state.score}`, 20, 52);

        // Mode / Target (Top Right)
        ctx.textAlign = "right";
        ctx.fillStyle = "#a1a1aa";
        ctx.font = "10px monospace";
        ctx.fillText(state.isInfinite ? "MODO ZEN" : "META", 780, 24);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 15px monospace";
        ctx.fillText(state.isInfinite ? "VIDAS: ∞" : `${state.score}/${activeLevel.targetScore}`, 780, 48);
        ctx.restore();

        ctx.restore(); // Restore scaled context

        // Sync React score state periodically for summary screens
        if (now - state.lastScoreSync > 500) {
          state.lastScoreSync = now;
          setScore(state.score);
        }

        if (state.gameActive) {
          animFrameId = requestAnimationFrame(render);
        }
      };

      animFrameId = requestAnimationFrame(render);

      return () => {
        stateRef.current.gameActive = false;
        cancelAnimationFrame(animFrameId);
        clearTimeout(spawnerTimerId);
      };
    }, [isPlaying, activeLevel]);

    const handleGameWin = () => {
      stateRef.current.gameActive = false;
      setGameResult("win");
      setIsPlaying(false);
    };

    const nextSlide = () => {
      setActiveSlide((prev) => Math.min(LEVELS.length - 1, prev + 1));
    };

    const prevSlide = () => {
      setActiveSlide((prev) => Math.max(0, prev - 1));
    };

    const startGame = (lvl: LevelConfig) => {
      setActiveLevel(lvl);
      setIsPlaying(true);
      // Wait for layout updates, then scale canvas
      setTimeout(() => resizeCanvas(), 30);
    };

    const exitGame = () => {
      setIsPlaying(false);
      setActiveLevel(null);
      setGameResult(null);
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.pointerType !== "mouse") {
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const state = stateRef.current;
      const rawX = e.clientX - rect.left;
      const rawY = e.clientY - rect.top;
      const x = (rawX - state.offsetX) / state.scale;
      const y = (rawY - state.offsetY) / state.scale;

      state.trail = [];
      state.lastPoint = null;
      registerPoint(x, y);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const state = stateRef.current;
      
      const rawX = e.clientX - rect.left;
      const rawY = e.clientY - rect.top;
      const x = (rawX - state.offsetX) / state.scale;
      const y = (rawY - state.offsetY) / state.scale;

      const lastPt = state.trail[state.trail.length - 1];
      let distance = 0;
      if (lastPt) {
        distance = Math.hypot(x - lastPt.x, y - lastPt.y);
      }

      if (!lastPt || distance > 2.0) {
        registerPoint(x, y);
      }
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.pointerType !== "mouse") {
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch (err) {}
      }
      
      if (stateRef.current.slicedInStrokeCount > 1) {
        const count = stateRef.current.slicedInStrokeCount;
        audioSynth.playCombo(count);
        if (stateRef.current.trail.length > 2) {
          const mid = stateRef.current.trail[Math.floor(stateRef.current.trail.length / 2)];
          stateRef.current.floatingTexts.push({
            id: crypto.randomUUID(),
            x: mid.x,
            y: mid.y - 20,
            text: `Combo x${count}`,
            alpha: 1,
            scale: 1.2,
            color: "#ffffff"
          });
        }
      }
      stateRef.current.slicedInStrokeCount = 0;
      stateRef.current.lastPoint = null;
    };

    const handlePointerLeave = () => {
      stateRef.current.trail = [];
      stateRef.current.lastPoint = null;
    };

    const slideLevel = LEVELS[activeSlide];
    const isUnlocked = activeSlide === 0 || activeSlide === 5 || completedLevels.includes(slideLevel.id - 1);

    return (
      <div ref={containerRef} className="w-full h-full flex flex-col items-center justify-center select-none bg-zinc-950 relative overflow-hidden">
        
        {/* Floating controls in game */}
        <div className="absolute top-4 left-4 right-4 z-40 flex items-center justify-between pointer-events-none">
          <div className="flex gap-2 pointer-events-auto">
            {onExitGame && (
              <Button
                variant="outline"
                size="sm"
                onClick={onExitGame}
                className="border-zinc-800 bg-zinc-900/90 text-white hover:bg-zinc-800 text-xs px-3 shadow-md cursor-pointer"
              >
                Cerrar Juego
              </Button>
            )}
            {isPlaying && (
              <Button
                variant="outline"
                size="sm"
                onClick={exitGame}
                className="border-zinc-800 bg-zinc-900/90 text-white hover:bg-zinc-800 text-xs px-3 shadow-md cursor-pointer"
              >
                Volver a Niveles
              </Button>
            )}
          </div>

          <div className="flex gap-2 pointer-events-auto">
            <Button
              variant="outline"
              size="icon"
              onClick={toggleMute}
              className="border-zinc-800 text-zinc-400 hover:text-white bg-zinc-900/90 cursor-pointer size-8"
            >
              {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </Button>
          </div>
        </div>

        {!isPlaying ? (
          /* Level Select Menu Carousel Screen */
          <div className="w-full h-full flex flex-col items-center justify-between p-8 text-center bg-zinc-950 relative">
            <div className="absolute inset-0 tactical-grid opacity-20 pointer-events-none" />

            <div className="z-10 mt-12">
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1 text-[0.65rem] font-mono uppercase tracking-[0.2em] text-zinc-400">
                Entrenamiento Gestual Zen
              </span>
              <h1 className="text-3xl font-bold tracking-tight text-white mt-4">
                Fruit Ninja Arcade
              </h1>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-2 leading-relaxed">
                Corta frutas rebanándolas con tu cursor de ratón o simulando ademanes gestuales. ¡Vidas infinitas activadas!
              </p>
            </div>

            {/* Carousel navigation slide */}
            <div className="z-10 w-full flex items-center justify-between max-w-lg my-4">
              <Button
                variant="outline"
                size="icon"
                onClick={prevSlide}
                disabled={activeSlide === 0}
                className="border-zinc-800 bg-zinc-900 text-white disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                <ArrowLeft className="size-4" />
              </Button>

              {/* Level card content */}
              <div className="flex-1 mx-6 rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm min-h-[160px] flex flex-col justify-between items-center relative">
                {!isUnlocked && (
                  <div className="absolute inset-0 rounded-xl bg-black/80 flex flex-col items-center justify-center text-zinc-500 gap-2 z-20">
                    <Lock className="size-6 text-zinc-400" />
                    <span className="text-[10px] font-mono uppercase tracking-wider">Nivel Bloqueado</span>
                    <span className="text-[9px] text-zinc-500">Completa el nivel anterior para desbloquear</span>
                  </div>
                )}

                <div className="text-center">
                  <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                    {slideLevel.id === 6 ? "Modo Libre" : `Nivel ${slideLevel.id}`}
                  </span>
                  <h3 className="text-lg font-bold text-white mt-1">{slideLevel.name}</h3>
                  <p className="text-xs text-zinc-400 mt-2 max-w-[240px] leading-relaxed">
                    {slideLevel.description}
                  </p>
                </div>

                <div className="mt-4 font-mono text-[10px] text-white bg-zinc-800/80 px-3 py-1 rounded-md border border-zinc-700">
                  {slideLevel.metaDesc}
                </div>
              </div>

              <Button
                variant="outline"
                size="icon"
                onClick={nextSlide}
                disabled={activeSlide === LEVELS.length - 1}
                className="border-zinc-800 bg-zinc-900 text-white disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                <ArrowRight className="size-4" />
              </Button>
            </div>

            {/* Carousel indicator dots */}
            <div className="z-10 flex gap-1.5 justify-center mb-2">
              {LEVELS.map((_, idx) => (
                <span
                  key={idx}
                  className={cn(
                    "size-1.5 rounded-full transition-all",
                    idx === activeSlide ? "bg-white w-4" : "bg-zinc-800"
                  )}
                />
              ))}
            </div>

            {/* Start Level CTA Button */}
            <div className="z-10 w-full max-w-xs mt-2 mb-12">
              {isUnlocked ? (
                <Button
                  onClick={() => startGame(slideLevel)}
                  className="w-full bg-white text-black hover:bg-zinc-200 gap-2 text-xs py-5 cursor-pointer font-semibold"
                >
                  <Play className="size-4 fill-current" />
                  Iniciar Nivel
                </Button>
              ) : (
                <Button
                  disabled
                  className="w-full bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed text-xs py-5"
                >
                  <Lock className="size-4 mr-2" />
                  Nivel Bloqueado
                </Button>
              )}
            </div>
          </div>
        ) : (
          /* Active gameplay canvas */
          <div className="w-full h-full relative cursor-crosshair flex items-center justify-center">
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerLeave}
              className="w-full h-full block bg-zinc-950"
            />
          </div>
        )}

        {/* Win Result screen */}
        {gameResult === "win" && (
          <div className="absolute inset-0 bg-black/95 flex flex-col justify-center items-center text-center p-8 z-30 animate-fade-in">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-1 text-[0.65rem] font-mono uppercase tracking-[0.2em] text-zinc-400">
              ¡Victoria!
            </span>
            
            <h1 className="text-3xl font-bold tracking-tight text-white mt-4">
              ¡Nivel Completado!
            </h1>
            <p className="text-sm text-zinc-400 mt-2 max-w-sm leading-relaxed">
              Excelente coordinación gestual. Lograste rebanar {score} frutas con precisión y has desbloqueado el siguiente nivel.
            </p>

            <div className="flex gap-4 mt-8 w-full max-w-xs justify-center">
              <Button
                onClick={() => activeLevel && startGame(activeLevel)}
                className="flex-1 bg-white text-black hover:bg-zinc-200 text-xs py-4 cursor-pointer font-semibold"
              >
                <RotateCcw className="size-4 mr-2" />
                Repetir Nivel
              </Button>
              <Button
                onClick={exitGame}
                variant="outline"
                className="flex-1 border-zinc-800 bg-zinc-900 text-white hover:bg-zinc-850 text-xs py-4 cursor-pointer"
              >
                Ver Niveles
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }
);

FruitNinjaGame.displayName = "FruitNinjaGame";
