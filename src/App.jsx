import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Activity, Zap, TrendingUp, Globe, Cpu, Server, Wifi, 
  BarChart2, Lock, ShieldCheck, Terminal, Crosshair, 
  AlertTriangle, Layers, Grid, Clock, BatteryCharging, ExternalLink, ChevronRight,
  CheckCircle2, XCircle, ArrowUpRight, ArrowDownRight, Coins, LineChart, Battery, Database, Power, ThumbsUp, Bot, Wallet,
  X, Snowflake, Gift, PartyPopper
} from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from "firebase/app";
import { getFirestore, doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";

// ==========================================
// 1. CONFIGURATION & INITIALIZATION
// ==========================================

const firebaseConfig = {
  apiKey: "AIzaSyDRGuUG8PygbScJljbfhtfjxPeN8inRhuY",
  authDomain: "mfx45-terminal-c6f74.firebaseapp.com",
  projectId: "mfx45-terminal-c6f74",
  storageBucket: "mfx45-terminal-c6f74.firebasestorage.app",
  messagingSenderId: "582184049784",
  appId: "1:582184049784:web:9cdc1e299c5ebea8eb218d"
};

// Initialize Backend Connection
let db;
try {
  if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "AIzaSy...") {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  }
} catch (e) {
  console.warn("Firebase initialization failed. Running offline.", e);
}

// ==========================================
// 2. CONSTANTS
// ==========================================

const EXCHANGES = [
  "BINANCE", "KUCOIN", "BYBIT", "EXNESS", "OCTAFX", "IQOPTION", 
  "DERIV", "COINBASE", "KRAKEN", "OKX", "QUOTEX", "POCKETOPTION", "GATE.IO"
];

// Regular Pairs (Mon-Thu Tokyo)
const REGULAR_DEFAULTS = {
  "BTC/USDT": 96450.00, "ETH/USDT": 3250.00, "XRP/USDT": 2.02,
  "SOL/USDT": 135.50, "EUR/USD": 1.0845, "GBP/USD": 1.2650,
  "XAU/USD": 2650.00, "NDX100": 18200.00, "US30": 39500.00
};

// OTC Pairs (Fri-Sun Tokyo)
const OTC_DEFAULTS = {
  "EUR/USD (OTC)": 1.0920, "GBP/USD (OTC)": 1.2750, "USD/JPY (OTC)": 145.00,
  "NZD/USD (OTC)": 0.6100, "AUD/USD (OTC)": 0.6500, "USD/CAD (OTC)": 1.3600,
  "XAU/USD (OTC)": 2645.00, 
  "BTC/USDT": 96500.00, // Standard Ticker for Crypto on Weekends
  "ETH/USDT": 3300.00   // Standard Ticker for Crypto on Weekends
};

// Default init pair
const INITIAL_PAIR = "BTC/USDT";
const INITIAL_PRICE = REGULAR_DEFAULTS[INITIAL_PAIR];

const MAX_HISTORY = 40; 
const MAX_CANDLES = 150; // Visible candles
const TOTAL_BUFFER = 400; // Data points in memory
const REFUEL_DURATION_MS = 60 * 60 * 1000; 
const CANDLE_DURATION = 30000; // 30 Seconds
const TICK_DURATION = 5000;    // 5 Seconds

// MFXT Price Constants
const MFXT_MIN_PRICE = 0.0000921;
const MFXT_MAX_PRICE = 0.0072341;

const TECH_INDICATORS = [
  "RSI(14)", "STOCH(9,6)", "STOCHRSI(14)", "MACD(12,26)", "ADX(14)", "W%R",
  "CCI(14)", "ATR(14)", "Highs/Lows", "Ult. Osc.", "ROC",
  "Bull/Bear", "SMA(5)", "SMA(10)", "SMA(20)", "SMA(50)", "SMA(100)", "SMA(200)", "EMA(10)", "EMA(50)"
];

// ==========================================
// 3. HELPER FUNCTIONS
// ==========================================

const randomFloat = (min, max) => Math.random() * (max - min) + min;
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const fmt = (num) => num.toFixed(2);
const fmtPrice = (price) => price < 10 ? price.toFixed(4) : price.toFixed(2);
const fmtMfxt = (price) => price.toFixed(8);

const getProgressColor = (p) => {
  if (p < 30) return "bg-gradient-to-r from-red-700 to-red-500 shadow-[0_0_15px_rgba(239,68,68,0.6)]";
  if (p < 60) return "bg-gradient-to-r from-red-500 to-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.6)]";
  if (p < 90) return "bg-gradient-to-r from-orange-500 to-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.6)]";
  return "bg-gradient-to-r from-yellow-400 to-green-500 shadow-[0_0_20px_rgba(34,197,94,0.8)]"; 
};

// --- CHAOS PRICE ENGINE ---
const seedRand = (co) => (Math.sin(co * 12.9898) * 43758.5453) % 1;

const getChaosPrice = (timestamp) => {
  const tick = Math.floor(timestamp / TICK_DURATION);
  const regimePeriod = 240; 
  const regimePhase = Math.sin(tick / regimePeriod); 
  const volPeriod = 60;
  let volatility = (Math.abs(Math.sin(tick / volPeriod)) + 0.5) * 0.7; 

  let noiseVal = 0;
  noiseVal += Math.sin(tick * 0.02) * 1.0;
  noiseVal += Math.cos(tick * 0.07) * 0.5;
  const jitter = (seedRand(tick) - 0.5) * 1.5; 
  noiseVal += jitter * 0.15 * volatility;

  let finalVal = noiseVal;
  if (Math.abs(regimePhase) < 0.4) {
      finalVal *= 0.25; 
      finalVal += Math.sin(tick * 0.5) * 0.05;
  } else {
      const direction = regimePhase > 0 ? 1 : -1;
      finalVal += (direction * (tick % regimePeriod) * 0.01); 
  }

  let normalized = (finalVal + 3) / 6;
  normalized = Math.abs(normalized % 1); 
  normalized = Math.max(0.02, Math.min(0.98, normalized));

  const range = MFXT_MAX_PRICE - MFXT_MIN_PRICE;
  return MFXT_MIN_PRICE + (normalized * range);
};

// --- CANDLESTICK GENERATOR ---
const generateMfxtCandles = () => {
  const now = Date.now();
  const candles = [];
  const currentCandleStart = Math.floor(now / CANDLE_DURATION) * CANDLE_DURATION;
  
  for (let i = TOTAL_BUFFER; i > 0; i--) {
    const candleTime = currentCandleStart - (i * CANDLE_DURATION);
    let open, close, high, low;
    for (let tick = 0; tick < 6; tick++) {
      const tickTime = candleTime + (tick * TICK_DURATION);
      const price = getChaosPrice(tickTime);
      if (tick === 0) { open = price; high = price; low = price; }
      high = Math.max(high, price);
      low = Math.min(low, price);
      close = price;
    }
    if (candles.length > 0) open = candles[candles.length - 1].c;
    const vol = Math.floor(seedRand(candleTime) * 5000) + 1000;
    candles.push({ o: open, h: high, l: low, c: close, v: vol, t: candleTime });
  }
  return candles;
};

const generateInitialCandles = (basePrice) => {
  const initial = [];
  let current = basePrice;
  for (let i = 0; i < MAX_CANDLES; i++) {
    const volatility = basePrice * 0.001;
    const open = current;
    const close = current + randomFloat(-volatility, volatility);
    const high = Math.max(open, close) + randomFloat(0, volatility * 0.5);
    const low = Math.min(open, close) - randomFloat(0, volatility * 0.5);
    initial.push({ o: open, h: high, l: low, c: close, v: Math.random() * 100 });
    current = close;
  }
  return initial;
};

// ------------------------------------------------------------------
// --- REACT COMPONENTS ---
// ------------------------------------------------------------------

const MFXTCoin3D = ({ size = "w-12 h-12" }) => (
  <div className={`relative ${size} group perspective-500 hover:scale-110 transition-transform duration-500`}>
    <div className="w-full h-full relative transform-style-3d animate-spin-slow-3d">
       <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-yellow-300 via-yellow-500 to-yellow-700 flex items-center justify-center border-[3px] border-yellow-200 backface-hidden shadow-[inset_0_0_10px_rgba(161,98,7,0.8)]">
         <div className="w-[65%] h-[65%] rounded-full border border-yellow-700/30 flex items-center justify-center">
           <span className="text-[0.6rem] font-black text-yellow-900 tracking-tighter">MFXT</span>
         </div>
       </div>
       <div className="absolute inset-0 rounded-full bg-gradient-to-bl from-yellow-300 via-yellow-500 to-yellow-700 flex items-center justify-center border-[3px] border-yellow-200 backface-hidden transform rotate-y-180 shadow-[inset_0_0_10px_rgba(161,98,7,0.8)]">
         <div className="w-[65%] h-[65%] rounded-full border border-yellow-700/30 flex items-center justify-center">
           <span className="text-[0.6rem] font-black text-yellow-900 tracking-tighter">MFXT</span>
         </div>
       </div>
       <div className="absolute inset-0 rounded-full bg-white opacity-10 animate-pulse pointer-events-none"></div>
    </div>
    <div className="absolute -inset-2 bg-yellow-500/20 blur-lg rounded-full animate-pulse pointer-events-none"></div>
  </div>
);

// --- SEASONAL SVGS ---
const SantaHatSvg = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
    <path d="M50 10 L80 80 L20 80 Z" fill="#dc2626" />
    <circle cx="50" cy="10" r="10" fill="white" />
    <rect x="15" y="75" width="70" height="15" rx="7" fill="white" />
  </svg>
);

const GiftBoxSvg = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]">
    <rect x="20" y="30" width="60" height="60" fill="#dc2626" />
    <rect x="20" y="30" width="60" height="60" fill="url(#giftGrad)" opacity="0.3" />
    <rect x="45" y="30" width="10" height="60" fill="#facc15" />
    <rect x="15" y="25" width="70" height="15" fill="#ef4444" />
    <rect x="45" y="25" width="10" height="15" fill="#facc15" />
    <path d="M50 25 C30 5 20 25 50 25 C70 5 80 25 50 25" fill="none" stroke="#facc15" strokeWidth="5" />
    <defs>
      <linearGradient id="giftGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="white" stopOpacity="0.5"/>
        <stop offset="100%" stopColor="black" stopOpacity="0.1"/>
      </linearGradient>
    </defs>
  </svg>
);

const FestiveOverlay = ({ isFading }) => {
  const particles = useMemo(() => {
    const items = [];
    for (let i = 0; i < 150; i++) items.push({ id: `snow-${i}`, type: 'snow', left: Math.random() * 100, delay: Math.random() * 5, duration: 3 + Math.random() * 7, size: 0.2 + Math.random() * 0.4 });
    for (let i = 0; i < 25; i++) items.push({ id: `hat-${i}`, type: 'hat', left: Math.random() * 100, delay: Math.random() * 5, duration: 4 + Math.random() * 6, size: 1.5 + Math.random() * 1.5 });
    return items;
  }, []);

  const fireworks = useMemo(() => Array.from({ length: 8 }).map((_, i) => ({ id: i, left: Math.random() * 80 + 10, top: Math.random() * 60 + 10, delay: Math.random() * 2, color: ['#ef4444', '#eab308', '#22c55e', '#3b82f6'][Math.floor(Math.random() * 4)] })), []);

  return (
    <div className={`fixed inset-0 z-50 pointer-events-none flex items-center justify-center overflow-hidden transition-opacity duration-2000 ${isFading ? 'opacity-0' : 'opacity-100'}`}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-fade-in"></div>
      {particles.map(p => (
        <div key={p.id} className={`absolute top-[-50px] ${p.type === 'snow' ? 'bg-white rounded-full opacity-80' : ''} animate-snowfall`} style={{ left: `${p.left}%`, width: `${p.size}rem`, height: `${p.size}rem`, animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s` }}>
          {p.type === 'hat' && <div className="w-full h-full animate-sway"><SantaHatSvg /></div>}
        </div>
      ))}
      {fireworks.map(fw => (
        <div key={`fw-${fw.id}`} className="absolute w-40 h-40 animate-firework opacity-0" style={{ left: `${fw.left}%`, top: `${fw.top}%`, animationDelay: `${fw.delay}s`, backgroundImage: `radial-gradient(circle, ${fw.color} 10%, transparent 60%)` }} />
      ))}
      <div className="relative bg-gradient-to-br from-red-900 via-black to-green-900 border-2 border-yellow-500/50 p-8 rounded-3xl shadow-[0_0_100px_rgba(220,38,38,0.5)] text-center animate-bounce-in max-w-md mx-4 overflow-hidden">
        <Bot className="w-20 h-20 text-yellow-400 mx-auto mb-6 animate-pulse drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
        <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-yellow-200 to-green-400 mb-3" style={{ fontFamily: '"Orbitron", sans-serif' }}>IT'S FESTIVE SEASON</h1>
        <p className="text-xl md:text-2xl text-cyan-300 font-bold font-mono tracking-widest drop-shadow-md">SEASONS GREETINGS <br/> <span className="text-white text-sm mt-2 block opacity-80">FROM MTRV.12</span></p>
      </div>
    </div>
  )
};

const ChristmasGiftOverlay = ({ isFading }) => {
  const gifts = useMemo(() => Array.from({ length: 40 }).map((_, i) => ({ id: i, left: Math.random() * 90 + 5, delay: Math.random() * 8, amount: Math.floor(randomFloat(100, 2500)), rotation: randomFloat(-20, 20) })), []);

  return (
    <div className={`fixed inset-0 z-50 pointer-events-none flex items-center justify-center overflow-hidden transition-opacity duration-2000 ${isFading ? 'opacity-0' : 'opacity-100'}`}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"></div>
      {Array.from({length: 50}).map((_,i) => ( <div key={`s-${i}`} className="absolute bg-white rounded-full opacity-50 animate-snowfall" style={{ left: `${Math.random()*100}%`, width: '0.2rem', height: '0.2rem', animationDuration: `${3+Math.random()*5}s`, animationDelay: `${Math.random()*5}s` }} /> ))}
      {gifts.map(g => (
        <div key={g.id} className="absolute top-[-100px] animate-gift-drop" style={{ left: `${g.left}%`, animationDelay: `${g.delay}s`, animationDuration: '6s', transform: `rotate(${g.rotation}deg)` }}>
          <div className="w-16 h-16 animate-gift-pop">
             <div className="w-full h-full gift-box"><GiftBoxSvg /></div>
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-green-400 font-black font-mono text-xl whitespace-nowrap opacity-0 animate-gift-reveal" style={{ textShadow: '0 0 10px rgba(74,222,128,0.8)' }}>+${g.amount}</div>
          </div>
        </div>
      ))}
      <div className="relative z-10 text-center animate-bounce-in">
         <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-red-500 via-red-400 to-white drop-shadow-[0_5px_15px_rgba(220,38,38,0.8)]" style={{ fontFamily: '"Orbitron", sans-serif' }}>MERRY CHRISTMAS!</h1>
      </div>
    </div>
  );
};

const NewYearOverlay = ({ isFading }) => {
  return (
    <div className={`fixed inset-0 z-50 pointer-events-none flex items-center justify-center overflow-hidden transition-opacity duration-2000 ${isFading ? 'opacity-0' : 'opacity-100'}`}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md animate-fade-in">
         <div className="absolute inset-0 opacity-20 bg-[linear-gradient(0deg,transparent_24%,rgba(34,211,238,0.3)_25%,rgba(34,211,238,0.3)_26%,transparent_27%,transparent_74%,rgba(34,211,238,0.3)_75%,rgba(34,211,238,0.3)_76%,transparent_77%,transparent),linear-gradient(90deg,transparent_24%,rgba(34,211,238,0.3)_25%,rgba(34,211,238,0.3)_26%,transparent_27%,transparent_74%,rgba(34,211,238,0.3)_75%,rgba(34,211,238,0.3)_76%,transparent_77%,transparent)]" style={{backgroundSize: '30px 30px'}}></div>
      </div>
      <div className="relative z-10 flex flex-col items-center gap-6 animate-zoom-in">
         <div className="relative">
            <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 drop-shadow-[0_0_30px_rgba(6,182,212,0.8)]" style={{ fontFamily: '"Orbitron", sans-serif' }}>2026</h1>
            <div className="absolute -inset-10 bg-cyan-500/20 blur-3xl rounded-full -z-10 animate-pulse"></div>
         </div>
         <div className="h-1 w-40 bg-gradient-to-r from-transparent via-purple-500 to-transparent"></div>
         <h2 className="text-2xl md:text-3xl font-bold text-white tracking-[0.5em] font-orbitron text-center">WELCOME TO THE FUTURE</h2>
         <p className="text-cyan-300 font-mono text-sm tracking-widest mt-2 animate-pulse">(HAPPY NEW YEAR)</p>
      </div>
    </div>
  );
};

const BotRefuelAnimation = ({ progress }) => {
  const coins = Array.from({ length: 15 }); 
  const barClass = getProgressColor(progress);
  return (
    <div className="relative w-full h-96 overflow-hidden bg-[#020205] rounded-xl border border-cyan-900/30 mb-4 shadow-[inset_0_0_60px_rgba(6,182,212,0.1)] flex flex-col items-center justify-center group">
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at center, #0e7490 0, transparent 70%), linear-gradient(0deg, transparent 24%, #0e7490 25%, #0e7490 26%, transparent 27%, transparent 74%, #0e7490 75%, #0e7490 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, #0e7490 25%, #0e7490 26%, transparent 27%, transparent 74%, #0e7490 75%, #0e7490 76%, transparent 77%, transparent)', backgroundSize: '100% 100%, 40px 40px, 40px 40px' }}></div>
      <div className="absolute inset-0 pointer-events-none z-20">
        {coins.map((_, i) => (
          <div key={i} className="absolute flex items-center justify-center coin-target-mouth" style={{ right: '-10%', top: `${35 + (Math.random() * 30)}%`, animationDelay: `${i * 1.6}s`, animationDuration: `25s` }}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-b from-yellow-300 via-yellow-500 to-yellow-700 flex items-center justify-center shadow-[0_0_15px_rgba(234,179,8,0.8)] border border-yellow-100">
               <div className="w-6 h-6 rounded-full border border-yellow-600/50 flex items-center justify-center bg-yellow-500/10"><span className="text-[7px] font-black text-yellow-950 tracking-tighter drop-shadow-sm">MFXT</span></div>
            </div>
          </div>
        ))}
      </div>
      <div className="absolute left-8 top-1/2 -translate-y-1/2 w-32 h-32 z-30">
        <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-[0_0_30px_rgba(6,182,212,0.6)]">
          <defs>
            <linearGradient id="cyberGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#1e293b" /><stop offset="50%" stopColor="#0f172a" /><stop offset="100%" stopColor="#020617" /></linearGradient>
            <filter id="neonGlow"><feGaussianBlur stdDeviation="1.5" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>
          <path d="M 40 60 L 140 60 L 160 90 L 140 140 L 40 140 L 20 110 L 20 90 Z" fill="url(#cyberGrad)" stroke="#06b6d4" strokeWidth="2" />
          <path d="M 50 70 L 90 70 L 100 80" fill="none" stroke="#06b6d4" strokeWidth="1" opacity="0.5" />
          <path d="M 50 130 L 90 130 L 100 120" fill="none" stroke="#06b6d4" strokeWidth="1" opacity="0.5" />
          <path d="M 30 85 L 110 85 L 100 100 L 30 100 Z" fill="#000" stroke="#06b6d4" strokeWidth="1" />
          <rect x="35" y="90" width="60" height="3" fill="#ef4444" filter="url(#neonGlow)" className="animate-pulse" />
          <g className="animate-intake-jaw origin-[90px_120px]">
             <path d="M 45 120 L 125 120 L 115 145 L 55 145 Z" fill="#1e293b" stroke="#0ea5e9" strokeWidth="1" />
             <ellipse cx="85" cy="120" rx="30" ry="8" fill="#0ea5e9" opacity="0.6" filter="url(#neonGlow)" className="animate-pulse" />
          </g>
          <path d="M 50 120 L 120 120" stroke="#94a3b8" strokeWidth="2" strokeDasharray="8 4" />
        </svg>
      </div>
      <div className="absolute top-6 w-full px-4 z-40 flex flex-col items-center">
         <div className="bg-black/90 backdrop-blur-xl border border-cyan-500/50 px-8 py-4 rounded-xl shadow-[0_0_30px_rgba(6,182,212,0.3)] flex flex-col items-center gap-2 text-center max-w-sm mx-4 animate-pulse-slow transform hover:scale-105 transition-transform duration-500">
            <div className="flex items-center gap-2 text-cyan-400"><Database className="w-4 h-4" /><span className="text-xs font-black tracking-[0.3em] uppercase">System Refueling</span></div>
            <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-500 to-transparent"></div>
            <span className="text-[11px] font-bold text-white tracking-widest leading-relaxed font-mono">INITIATE YOUR WITHDRAWAL NOW <br/> OR COME BACK LATER</span>
         </div>
      </div>
      <div className="absolute bottom-6 w-3/4 max-w-xs z-40 bg-black/90 backdrop-blur-xl p-4 rounded-2xl border border-slate-700 flex flex-col items-center gap-3 shadow-2xl">
         <div className="flex items-center gap-2 text-cyan-400 w-full justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2"><BatteryCharging className="w-4 h-4 animate-bounce" /><span className="text-[10px] font-black tracking-widest">ENERGY CORE</span></div>
            <span className="text-xs font-mono text-white">{Math.floor(progress)}%</span>
         </div>
         <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden relative border border-slate-800">
            <div className="absolute inset-0 opacity-30" style={{backgroundImage: 'linear-gradient(90deg, transparent 2px, #000 2px)', backgroundSize: '4px 100%'}}></div>
            <div className={`h-full transition-all duration-300 ease-linear ${barClass}`} style={{ width: `${progress}%` }}></div>
         </div>
         <a href="https://mfx45.com" target="_blank" rel="noopener noreferrer" className="mt-2 w-full flex items-center justify-center gap-2 text-[10px] font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 py-2 rounded-lg shadow-lg transition-all active:scale-95 border border-cyan-500/30 hover:shadow-[0_0_15px_rgba(6,182,212,0.5)]"><Wallet className="w-3 h-3" /> WITHDRAW FUNDS</a>
      </div>
    </div>
  );
};

const RobotReadyAnimation = () => (
  <div className="relative w-full h-96 flex flex-col items-center justify-center bg-[#020205] rounded-lg border border-green-500/50 mb-4 shadow-[0_0_50px_rgba(34,197,94,0.3)] overflow-hidden">
    <div className="absolute inset-0 overflow-hidden">
       {[...Array(20)].map((_, i) => ( <div key={i} className="absolute w-1 h-1 bg-green-400 rounded-full animate-ping" style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, animationDelay: `${Math.random()}s`, animationDuration: '2s' }} /> ))}
    </div>
    <div className="relative z-10 mb-4 transform transition-all duration-500 animate-bounce">
       <Bot className="w-32 h-32 text-green-400 drop-shadow-[0_0_15px_rgba(34,197,94,0.8)]" />
       <div className="absolute -bottom-2 -right-2 bg-black rounded-full p-2 border border-green-500"><ThumbsUp className="w-10 h-10 text-green-500 fill-current" /></div>
    </div>
    <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-200 tracking-widest z-10 animate-pulse">I AM READY</h2>
    <div className="text-green-600 font-mono text-xs mt-2 tracking-[0.5em]">SYSTEM RESTARTING...</div>
  </div>
);

const StatusBadge = ({ active, progress, isReady }) => (
  <div className="relative group min-w-[140px] md:min-w-[180px] scale-90 md:scale-100 origin-right">
    <div className={`absolute -inset-0.5 bg-gradient-to-r ${active ? 'from-green-600 to-emerald-600' : (isReady ? 'from-green-400 to-teal-400' : 'from-yellow-600 to-orange-600')} rounded-full blur opacity-75 transition duration-500`}></div>
    <div className={`relative flex items-center gap-2 md:gap-3 px-3 md:px-4 py-1.5 bg-black rounded-full border ${active ? 'border-green-500/30' : (isReady ? 'border-green-400' : 'border-orange-500/30')} shadow-lg overflow-hidden`}>
      {!active && !isReady && <div className={`absolute left-0 top-0 h-full transition-all duration-100 ease-linear ${getProgressColor(progress).split(' ')[0].replace('bg-', 'bg-opacity-20 bg-')}`} style={{ width: `${progress}%` }}></div>}
      <div className="relative flex items-center justify-center z-10">
         {active || isReady ? ( <div className="relative flex items-center justify-center w-2 h-2"><div className="absolute w-full h-full bg-green-500 rounded-full animate-ping opacity-75"></div><div className="relative w-1.5 h-1.5 bg-green-400 rounded-full"></div></div> ) : ( <BatteryCharging className="w-3 h-3 text-orange-400 animate-pulse" /> )}
      </div>
      <span className={`${active || isReady ? 'text-green-400' : 'text-orange-400'} font-mono font-bold tracking-widest text-[9px] md:text-[10px] z-10 flex justify-between w-full items-center whitespace-nowrap`}>
        <span>{active ? 'SYSTEM ACTIVE' : (isReady ? 'SYSTEM READY' : 'REFILLING')}</span>
        {!active && !isReady && <span className="ml-2">{Math.floor(progress)}%</span>}
      </span>
    </div>
  </div>
);

const TradeButton = () => (
  <a href="https://mfx45.com" target="_blank" rel="noopener noreferrer" className="relative inline-flex items-center justify-center px-6 py-2 overflow-hidden font-bold text-white rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 shadow-[0_0_20px_rgba(6,182,212,0.8)] transition-all duration-300 transform hover:scale-105 hover:shadow-[0_0_40px_rgba(168,85,247,0.8)] animate-pulse-glow">
    <span className="absolute inset-0 bg-white/20 rounded-full animate-ping opacity-20"></span>
    <span className="relative flex items-center gap-2 tracking-widest text-sm uppercase">Trade Now <ChevronRight className="w-4 h-4 animate-bounce-x" /></span>
  </a>
);

const MFX45Bot = () => {
  const [isBackendRunning, setIsBackendRunning] = useState(true); 
  const [refillEndTime, setRefillEndTime] = useState(null); 
  const [refillProgress, setRefillProgress] = useState(0); 
  const [isReadySequence, setIsReadySequence] = useState(false); 
  const isSystemRunning = isBackendRunning && !isReadySequence;

  const [trades, setTrades] = useState([]);
  const [currentPair, setCurrentPair] = useState(INITIAL_PAIR);
  const [marketPrice, setMarketPrice] = useState(INITIAL_PRICE);
  const [candles, setCandles] = useState(() => generateInitialCandles(INITIAL_PRICE));
  const [displayedProfit, setDisplayedProfit] = useState(0);
  const [winRate, setWinRate] = useState(94.2);
  const [systemLog, setSystemLog] = useState(["INITIALIZING KERNEL..."]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [indicatorSignals, setIndicatorSignals] = useState({});
  const [consensus, setConsensus] = useState("NEUTRAL");
  const [exchangeStatuses, setExchangeStatuses] = useState({});
  const [isDbConnected, setIsDbConnected] = useState(!!db);
  const [chartViewMode, setChartViewMode] = useState('MARKET');
  
  // Seasonal States
  const [seasonMode, setSeasonMode] = useState('NONE'); 
  const [isSeasonFading, setIsSeasonFading] = useState(false);

  // MFXT State
  const [mfxtPrice, setMfxtPrice] = useState(() => getChaosPrice(Date.now()));
  const [mfxtTrend, setMfxtTrend] = useState('up');
  const [mfxtHistory, setMfxtHistory] = useState(() => generateMfxtCandles()); 
  
  const realTimeProfitRef = useRef(0); 
  const tickCountRef = useRef(0);
  const trendDirRef = useRef(1); 
  
  const lossTargets = [8, 23, 25, 39, 45, 103];
  const nextLossTargetRef = useRef(lossTargets[Math.floor(Math.random() * lossTargets.length)]);
  const currentProfitCountRef = useRef(0); 
  const pendingLossesRef = useRef(0);
  
  const fmtTime = (date) => `${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}:${date.getSeconds().toString().padStart(2,'0')}.${date.getMilliseconds().toString().padStart(3,'0')}`;
  const fmtAsianTime = (date) => new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short', month: 'short', day: 'numeric' }).format(date);
  const addLog = (msg) => setSystemLog(prev => [`> ${msg}`, ...prev].slice(0, 6));

  // --- SEASONAL LOGIC ---
  useEffect(() => {
    const checkSeason = () => {
      const tokyoNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
      const month = tokyoNow.getMonth(); 
      const day = tokyoNow.getDate();
      
      let mode = 'NONE';
      let duration = 10000; 

      if (month === 11) { // December
        if (day >= 25 && day <= 31) { 
          mode = 'CHRISTMAS';
          duration = 15000;
        } else if (day <= 24) { 
          mode = 'FESTIVE';
          duration = 10000;
        }
      } else if (month === 0 && day <= 30) { 
        mode = 'NEWYEAR';
        duration = 12000;
      }

      if (mode !== 'NONE') {
        setSeasonMode(mode);
        setTimeout(() => setIsSeasonFading(true), duration - 2000);
        setTimeout(() => setSeasonMode('NONE'), duration);
      }
    };
    checkSeason();
  }, []);

  // --- EXCHANGE STATUS SHUFFLER ---
  useEffect(() => {
    const initialStatus = {};
    EXCHANGES.forEach(ex => initialStatus[ex] = "CONNECTED");
    setExchangeStatuses(initialStatus);
    const shuffle = () => {
       setExchangeStatuses(prev => {
         const currentlyReconnecting = Object.values(prev).filter(s => s === "RECONNECTING").length;
         const randomExchange = EXCHANGES[Math.floor(Math.random() * EXCHANGES.length)];
         const currentStatus = prev[randomExchange];
         let newStatus = currentStatus;
         if (currentStatus === "CONNECTED") {
            if (currentlyReconnecting < 4 && Math.random() > 0.8) newStatus = "RECONNECTING";
         } else {
            if (Math.random() > 0.3) newStatus = "CONNECTED";
         }
         if (newStatus !== currentStatus) return { ...prev, [randomExchange]: newStatus };
         return prev;
       });
       setTimeout(shuffle, randomInt(2000, 5000));
    };
    const timer = setTimeout(shuffle, 2000);
    return () => clearTimeout(timer);
  }, []);

  // --- DB LISTENERS ---
  useEffect(() => {
    if (!db) { setIsDbConnected(true); return; }
    setIsDbConnected(true);
    const unsubControl = onSnapshot(doc(db, "bot_settings", "control"), async (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        if (data.isRunning !== undefined) {
          if (data.isRunning) {
             setIsBackendRunning((prev) => true);
             setRefillProgress(0); 
             setRefillEndTime(null);
             setIsReadySequence(false);
          } else {
             setIsBackendRunning(false);
             if (data.refillEndTime) {
                setRefillEndTime(data.refillEndTime);
             } else {
                 const targetTime = Date.now() + REFUEL_DURATION_MS;
                 await setDoc(doc(db, "bot_settings", "control"), { isRunning: false, refillEndTime: targetTime }, { merge: true });
             }
          }
        }
      }
    });
    const scheduleInterval = setInterval(async () => {
      const now = new Date();
      const tokyoTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
      const hours = tokyoTime.getHours();
      const minutes = tokyoTime.getMinutes();
      const isStartWindow = (hours === 23 && minutes === 30);
      const isRefuelPeriod = (hours === 23 && minutes >= 30) || (hours === 0 && minutes < 30);
      try {
        const snap = await getDoc(doc(db, "bot_settings", "control"));
        if (snap.exists()) {
          const data = snap.data();
          const currentRunning = data.isRunning;
          if (isStartWindow && currentRunning) {
            const targetTime = Date.now() + (60 * 60 * 1000); 
            await setDoc(doc(db, "bot_settings", "control"), { isRunning: false, refillEndTime: targetTime }, { merge: true });
            addLog("SCHEDULED MAINTENANCE: INITIATING REFUEL (TOKYO 23:30).");
          } 
          else if (!isRefuelPeriod && !currentRunning && data.refillEndTime) {
            if (data.refillEndTime < Date.now()) {
               await setDoc(doc(db, "bot_settings", "control"), { isRunning: true, refillEndTime: null }, { merge: true });
               addLog("SCHEDULE COMPLETE: SYSTEM RESUMING.");
            }
          }
        }
      } catch(e) {}
    }, 10000); 
    const unsubMxt = onSnapshot(doc(db, "bot_data", "mfxt_token"), (docSnapshot) => { 
      if (!docSnapshot.exists()) {
        setDoc(doc(db, "bot_data", "mfxt_token"), { price: 0.00015000, trend: 'up', nextUpdateAt: Date.now() + 5000 }).catch(e => console.log("Init DB error", e));
      }
    });
    return () => { unsubControl(); unsubMxt(); clearInterval(scheduleInterval); };
  }, []);

  // --- REFUEL LOGIC ---
  useEffect(() => {
    let interval;
    if (!isBackendRunning || isReadySequence) {
      interval = setInterval(async () => {
        let progress = 0;
        if (isReadySequence) return;
        if (refillEndTime) {
          const now = Date.now();
          const remaining = refillEndTime - now;
          const totalDuration = 3600000; 
          progress = 100 - ((remaining / totalDuration) * 100);
          if (progress < 0) progress = 0; 
          if (remaining <= 0) {
             setRefillProgress(100);
             if (!isReadySequence) {
                setIsReadySequence(true);
                setTimeout(async () => {
                   if (db) await setDoc(doc(db, "bot_settings", "control"), { isRunning: true, refillEndTime: null }, { merge: true });
                }, 3000);
             }
             return;
          }
        } else {
          const now = new Date();
          const tokyoTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
          const hours = tokyoTime.getHours();
          const minutes = tokyoTime.getMinutes();
          const isRefuelPeriod = (hours === 23 && minutes >= 30) || (hours === 0 && minutes < 30);
          if(isRefuelPeriod) {
             const minutesIntoPeriod = (hours === 23) ? (minutes - 30) : (minutes + 30);
             progress = (minutesIntoPeriod / 60) * 100;
          } else {
             progress = 100;
             if (!isReadySequence) {
               setIsReadySequence(true);
               setTimeout(() => { setIsBackendRunning(true); setIsReadySequence(false); setRefillProgress(0); }, 3000);
             }
             return;
          }
        }
        if (progress > 100) progress = 100;
        setRefillProgress(progress);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isBackendRunning, refillEndTime, refillProgress, isReadySequence]);

  // --- MFXT LIVE ENGINE ---
  useEffect(() => {
    const interval = setInterval(() => {
       const now = Date.now();
       const currentPrice = getChaosPrice(now); 
       setMfxtPrice(currentPrice);
       setMfxtTrend(currentPrice >= mfxtPrice ? 'up' : 'down');
       setMfxtHistory(prev => {
          const currentBlockStart = Math.floor(now / CANDLE_DURATION) * CANDLE_DURATION;
          const lastCandle = prev[prev.length - 1];
          let newHistory = [...prev];
          if (lastCandle && lastCandle.t === currentBlockStart) {
             newHistory[newHistory.length - 1] = { ...lastCandle, c: currentPrice, h: Math.max(lastCandle.h, currentPrice), l: Math.min(lastCandle.l, currentPrice), v: lastCandle.v + Math.floor(Math.random()*50) };
          } else {
             const open = lastCandle ? lastCandle.c : currentPrice;
             newHistory.push({ o: open, c: currentPrice, h: Math.max(open, currentPrice), l: Math.min(open, currentPrice), v: 500, t: currentBlockStart });
             if (newHistory.length > MAX_CANDLES) newHistory.shift(); 
          }
          return newHistory;
       });
    }, 1000); 
    return () => clearInterval(interval);
  }, []);

  // --- EFFECT 0: CLOCK ---
  useEffect(() => { const timer = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(timer); }, []);

  // --- EFFECT 1: ASSET SWITCHING ---
  useEffect(() => {
    if (!isSystemRunning) return;
    const switchInterval = setInterval(() => {
      if (chartViewMode === 'MARKET') {
        const now = new Date();
        const tokyoDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
        const day = tokyoDate.getDay(); 
        const isOTC = (day === 5 || day === 6 || day === 0);
        const activeDefaults = isOTC ? OTC_DEFAULTS : REGULAR_DEFAULTS;
        const activePairs = Object.keys(activeDefaults);
        const newPair = activePairs[Math.floor(Math.random() * activePairs.length)];
        const newBasePrice = activeDefaults[newPair];
        setCurrentPair(newPair);
        setMarketPrice(newBasePrice);
        setCandles(generateInitialCandles(newBasePrice));
        tickCountRef.current = 0;
        addLog(`SWITCHING ASSET >>> ${newPair}`);
        addLog(`LIQUIDITY POOL STATUS: UPDATED (${isOTC ? 'OTC' : 'REGULAR'})`); 
      }
    }, 10000);
    return () => clearInterval(switchInterval);
  }, [isSystemRunning, chartViewMode]); 

  // --- EFFECT 2: PROFIT & LOSS ---
  useEffect(() => {
    let timeoutId;
    const scheduleNextUpdate = () => {
      if (!isSystemRunning) return;
      const delay = randomInt(600000, 2100000);
      timeoutId = setTimeout(() => {
         if (pendingLossesRef.current > 0) {
             const lossAmount = randomFloat(500, 2149);
             realTimeProfitRef.current -= lossAmount;
             pendingLossesRef.current -= 1;
             addLog(`MARKET CORRECTION: -$${fmt(lossAmount)} | ADJUSTING ALGORITHM...`);
             if (pendingLossesRef.current === 0) {
                currentProfitCountRef.current = 0;
                nextLossTargetRef.current = lossTargets[Math.floor(Math.random() * lossTargets.length)];
             }
         } else {
             const addedAmount = randomFloat(570, 1240);
             realTimeProfitRef.current += addedAmount;
             currentProfitCountRef.current += 1;
             addLog(`PROFIT SECURED: +$${fmt(addedAmount)} | SYNCING WALLET NODES...`);
             if (currentProfitCountRef.current >= nextLossTargetRef.current) { pendingLossesRef.current = 1; }
         }
         setDisplayedProfit(realTimeProfitRef.current);
         scheduleNextUpdate(); 
      }, delay);
    };
    if (isSystemRunning) scheduleNextUpdate();
    return () => clearTimeout(timeoutId);
  }, [isSystemRunning]);

  // --- EFFECT 3: INDICATOR SIMULATION ---
  useEffect(() => {
    if(!isSystemRunning) return;
    const interval = setInterval(() => {
      const newSignals = {};
      let buyCount = 0; let sellCount = 0;
      TECH_INDICATORS.forEach(ind => {
        const align = Math.random() > 0.2;
        let signal = "NEUTRAL";
        if (trendDirRef.current === 1) signal = align ? "BUY" : "SELL";
        else signal = align ? "SELL" : "BUY";
        if(signal === "BUY") buyCount++; if(signal === "SELL") sellCount++;
        newSignals[ind] = signal;
      });
      setIndicatorSignals(newSignals);
      if (buyCount > sellCount + 5) setConsensus("STRONG BUY");
      else if (sellCount > buyCount + 5) setConsensus("STRONG SELL");
      else if (buyCount > sellCount) setConsensus("BUY");
      else setConsensus("SELL");
    }, 1000); 
    return () => clearInterval(interval);
  }, [isSystemRunning]);

  // --- EFFECT 4: HIGH FREQUENCY ENGINE ---
  useEffect(() => {
    if (!isSystemRunning) return;
    const interval = setInterval(() => {
      const now = new Date();
      setMarketPrice(prev => {
        if (Math.random() > 0.98) trendDirRef.current *= -1;
        const volatility = prev * 0.0003; 
        const bias = volatility * 0.2 * trendDirRef.current;
        const change = randomFloat(-volatility, volatility) + bias;
        const newPrice = prev + change;
        setCandles(prevCandles => {
          if (prevCandles.length === 0) return prevCandles;
          const updated = [...prevCandles];
          const lastIdx = updated.length - 1;
          const last = { ...updated[lastIdx] };
          last.c = newPrice; last.h = Math.max(last.h, newPrice); last.l = Math.min(last.l, newPrice);
          updated[lastIdx] = last;
          tickCountRef.current += 1;
          if (tickCountRef.current > 10) {
            tickCountRef.current = 0;
            const nextOpen = newPrice;
            updated.shift();
            updated.push({ o: nextOpen, h: nextOpen, l: nextOpen, c: nextOpen, v: Math.random() * 100 });
          }
          return updated;
        });
        return newPrice;
      });
      if (Math.random() > 0.15) {
        const isWin = Math.random() < (parseFloat(winRate) / 100);
        const profit = isWin ? randomFloat(10, 250) : randomFloat(-25, -5);
        const trade = { id: Math.random().toString(36).substr(2, 9), time: now, exchange: EXCHANGES[Math.floor(Math.random() * EXCHANGES.length)], pair: currentPair, side: Math.random() > 0.5 ? 'BUY' : 'SELL', price: marketPrice, profit, status: isWin ? 'WIN' : 'LOSS' };
        setTrades(prev => [trade, ...prev].slice(0, MAX_HISTORY));
      }
    }, 100);
    return () => clearInterval(interval);
  }, [currentPair, marketPrice, winRate, isSystemRunning]);

  const getChartData = () => {
     if (chartViewMode === 'MFXT') return { data: mfxtHistory.slice(-MAX_CANDLES), current: mfxtPrice, isMfxt: true };
     return { data: candles.slice(-MAX_CANDLES), current: marketPrice, isMfxt: false };
  };
  const { data, current, isMfxt } = getChartData();
  const allHighs = data.map(c => c.h);
  const allLows = data.map(c => c.l);
  const minP = Math.min(...allLows) * (isMfxt ? 0.999 : 0.9998);
  const maxP = Math.max(...allHighs) * (isMfxt ? 1.001 : 1.0002);
  const range = maxP - minP || 0.000001;
  const getY = (p) => { if(!Number.isFinite(p)) return 50; return Math.max(0, Math.min(100, 100 - ((p - minP) / range) * 100)); };
  const candleWidth = (100 / MAX_CANDLES) * 0.6;
  const gridPrices = [0.2, 0.4, 0.6, 0.8].map(r => minP + (range * r));

  return (
    <div className="min-h-screen bg-[#050510] text-cyan-500 font-mono p-2 md:p-4 flex flex-col relative overflow-hidden selection:bg-cyan-500/30 selection:text-cyan-100">
      
      <div className="absolute inset-0 pointer-events-none z-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(6,182,212,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-cyan-900/10 to-transparent pointer-events-none z-0"></div>

      {seasonMode === 'FESTIVE' && <FestiveOverlay isFading={isSeasonFading} />}
      {seasonMode === 'CHRISTMAS' && <ChristmasGiftOverlay isFading={isSeasonFading} />}
      {seasonMode === 'NEWYEAR' && <NewYearOverlay isFading={isSeasonFading} />}

      <header className="relative z-10 flex flex-col xl:flex-row justify-between items-center bg-[#0a0a18]/80 backdrop-blur-xl border-b border-cyan-900/50 p-4 mb-4 rounded-sm shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-4 mb-4 xl:mb-0 w-full xl:w-auto justify-between xl:justify-start">
          <div className="flex items-center gap-4">
            <div className="relative w-10 h-10 flex items-center justify-center bg-cyan-950/30 border border-cyan-500/30 rounded clip-corner cursor-pointer" onClick={() => { if(!isReadySequence) { setIsSystemRunning(!isSystemRunning); setRefillProgress(0); } }}>
              <Cpu className={`w-6 h-6 text-cyan-400 ${isSystemRunning ? 'animate-pulse' : ''}`} />
            </div>
            <div className="cursor-default">
              <h1 className="text-xl md:text-3xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]" style={{ fontFamily: '"Orbitron", sans-serif' }}>
                MFX45 <span className="text-white text-xs md:text-lg font-bold tracking-[0.2em] ml-1">TRADING ROBOT</span>
              </h1>
              <div className="flex items-center gap-2 text-[10px] tracking-widest text-cyan-400 mt-1" style={{ fontFamily: '"Orbitron", sans-serif' }}>
                <span className="bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.3)]">V.12.0</span>
                {db ? (<span className="text-green-500 flex items-center gap-1"><Database className="w-3 h-3"/> SERVER CONNECTED</span>) : (<span className="text-red-500 flex items-center gap-1"><Wifi className="w-3 h-3"/> CONNECTING...</span>)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 xl:hidden"><TradeButton /></div>
        </div>

        <div className="flex flex-wrap justify-center xl:justify-end gap-4 xl:gap-8 items-center w-full">
          <div className="flex items-center gap-4 px-5 py-1.5 border border-purple-500/20 bg-purple-900/5 rounded-full cursor-pointer hover:bg-purple-900/20 transition-all shadow-[0_0_15px_rgba(168,85,247,0.1)] group hidden sm:flex" onClick={() => setChartViewMode(prev => prev === 'MARKET' ? 'MFXT' : 'MARKET')}>
             <MFXTCoin3D size="w-10 h-10" />
             <div className="flex flex-col justify-center -space-y-0.5">
               <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-200 via-white to-purple-200 tracking-tighter group-hover:scale-105 transition-transform">MFXT</h2>
               <span className="text-[8px] font-bold text-purple-400 tracking-[0.3em] uppercase group-hover:text-purple-300">Native Token</span>
             </div>
          </div>
          <div className="flex flex-col items-end px-4 border-r border-cyan-900/50 hidden md:flex">
             <span className="text-[10px] text-cyan-600 font-bold uppercase tracking-widest mb-1 flex items-center gap-1"><Clock className="w-3 h-3" /> TOKYO SESSION</span>
             <span className="text-lg font-mono font-bold text-white/90 tracking-wider">{fmtAsianTime(currentTime).split(',')[1] ? fmtAsianTime(currentTime).split(',')[1] + ' ' + fmtAsianTime(currentTime).split(',')[2] : fmtAsianTime(currentTime)}</span>
          </div>
          <div className="flex flex-col items-end group cursor-default">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Active Profit</span>
            <span className={`text-xl md:text-2xl font-bold font-mono tracking-tight ${displayedProfit >= 0 ? 'text-emerald-400' : 'text-red-500'} ${isSystemRunning ? '' : 'opacity-50'}`}>${displayedProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <StatusBadge active={isSystemRunning} progress={refillProgress} isReady={isReadySequence} />
          <div className="hidden xl:block"><TradeButton /></div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 relative z-10 overflow-hidden transition-opacity duration-500">
        {/* LEFT: CHART & ANALYSIS */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="flex-1 bg-[#0a0a18]/80 border border-cyan-900/30 rounded-sm relative flex flex-col overflow-hidden shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] h-96 lg:h-auto">
             <div className="flex justify-between items-center p-3 border-b border-cyan-900/30 bg-cyan-950/10">
               <div className="flex items-center gap-3">
                 {chartViewMode === 'MFXT' ? (<><LineChart className="w-4 h-4 text-purple-400" /><span className="text-lg font-bold text-purple-400 tracking-wider">MFXT / USD (30S)</span></>) : (<><Globe className="w-4 h-4 text-cyan-400" /><span className="text-lg font-bold text-white tracking-wider">{currentPair}</span></>)}
                 {isSystemRunning && <span className="text-xs px-2 py-0.5 bg-green-900/20 text-green-400 border border-green-900/50 rounded">LIVE</span>}
               </div>
               <div className="flex gap-2">
                 <div className={`flex items-center gap-2 px-3 py-1 rounded border ${consensus.includes("BUY") ? "bg-green-900/30 border-green-500 text-green-400" : "bg-red-900/30 border-red-500 text-red-400"}`}><Activity className="w-4 h-4" /><span className="font-bold text-xs tracking-wider">{consensus}</span></div>
               </div>
             </div>
             <div className="flex-1 relative w-full h-full p-4">
                {!isSystemRunning && (<div className="absolute inset-0 flex items-center justify-center z-20 bg-black/40 backdrop-blur-sm"><div className="flex flex-col items-center justify-center w-full h-full max-w-md gap-4 scale-75 md:scale-100">{isReadySequence ? <RobotReadyAnimation /> : <BotRefuelAnimation progress={refillProgress} />}</div></div>)}
                <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                  {gridPrices.map((price, i) => (<g key={i}><line x1="0" y1={getY(price)} x2="100" y2={getY(price)} stroke="#334155" strokeWidth="0.1" strokeDasharray="2" opacity="0.3" /><text x="100.5" y={getY(price)} className="text-[3px] fill-slate-500 font-mono opacity-70" alignmentBaseline="middle">{isMfxt ? fmtMfxt(price) : fmtPrice(price)}</text></g>))}
                  {data.map((c, i) => { const isUp = c.c >= c.o; const color = isUp ? "#10b981" : "#ef4444"; const x = (i / (data.length-1)) * 100; const yHigh = getY(c.h); const yLow = getY(c.l); const yOpen = getY(c.o); const yClose = getY(c.c); const bTop = Math.min(yOpen, yClose); const bH = Math.max(Math.abs(yOpen - yClose), 0.3); const vH = (c.v / 5000) * 10; return (<g key={i}><rect x={x - candleWidth/2} y={100-vH} width={candleWidth} height={vH} fill={color} opacity="0.15" /><line x1={x} y1={yHigh} x2={x} y2={yLow} stroke={color} strokeWidth="0.15" /><rect x={x - candleWidth/2} y={bTop} width={candleWidth} height={bH} fill={color} /></g>) })}
                  <line x1="0" y1={getY(current)} x2="100" y2={getY(current)} stroke="#fff" strokeWidth="0.15" strokeDasharray="2" opacity="0.6" />
                </svg>
                <div className={`absolute right-0 px-2 py-1 text-black font-bold text-xs rounded-l shadow-lg transform translate-x-1 transition-all duration-100 ${isMfxt ? 'bg-purple-500' : 'bg-cyan-500'}`} style={{ top: `${getY(current)}%`, transform: 'translateY(-50%)' }}>{isMfxt ? fmtMfxt(current) : fmtPrice(current)}</div>
             </div>
             <div className="h-8 bg-[#050510] border-t border-cyan-900/30 flex items-center px-4 justify-between text-[10px] text-cyan-700 font-mono">
                <div className="flex gap-4"><span>RSI: <span className="text-cyan-400">{(Math.random()*30 + 40).toFixed(1)}</span></span></div>
                <div className="flex items-center gap-2"><Wifi className={`w-3 h-3 ${isSystemRunning ? 'animate-pulse' : 'text-red-500'}`} />{isSystemRunning ? 'LATENCY: 12ms' : 'OFFLINE'}</div>
             </div>
          </div>
          <div className="h-auto md:h-48 grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className="col-span-2 bg-black/40 border border-cyan-900/30 rounded-sm p-2 font-mono text-[10px] overflow-hidden relative min-h-[100px]">
                <h3 className="text-cyan-700 border-b border-cyan-900/30 mb-1 pb-1">KERNEL OPERATIONS</h3>
                <div className="flex flex-col gap-1 text-cyan-500/80">{systemLog.map((line, i) => (<div key={i} className="truncate animate-pulse">{line}</div>))}</div>
             </div>
             <div className="col-span-1 bg-black/40 border border-cyan-900/30 rounded-sm p-2 overflow-y-auto custom-scrollbar min-h-[100px]">
               <h3 className="text-cyan-700 text-[10px] border-b border-cyan-900/30 mb-1 pb-1 flex justify-between"><span>NODES</span> <Server className="w-3 h-3" /></h3>
               {EXCHANGES.slice(0,8).map(ex => (<div key={ex} className="flex justify-between items-center text-[9px] py-1 border-b border-white/5"><span className="text-slate-400">{ex}</span><span className={exchangeStatuses[ex] === "RECONNECTING" ? "text-amber-400 flex items-center gap-1" : "text-green-400 animate-pulse"}>{exchangeStatuses[ex] === "RECONNECTING" ? (<>RECONNECTING <span className="animate-dots">...</span></>) : "CONNECTED"}</span></div>))}
             </div>
          </div>
        </div>

        {/* RIGHT: TRADE LOG */}
        <div className="lg:col-span-4 flex flex-col bg-[#0a0a18]/90 border border-cyan-900/30 rounded-sm overflow-hidden shadow-lg h-[500px] lg:h-auto">
          <div className="p-3 bg-gradient-to-r from-cyan-950/40 to-transparent border-b border-cyan-900/30 flex justify-between items-center">
            <div className="flex items-center gap-2"><Layers className="w-4 h-4 text-cyan-400" /><h2 className="font-bold text-sm text-white tracking-wider">ORDER BOOK</h2></div>
          </div>
          <div className="grid grid-cols-4 text-[10px] text-cyan-700 font-bold px-3 py-2 border-b border-cyan-900/20 bg-[#050510]"><span>TIME</span> <span>PAIR</span> <span className="text-center">TYPE</span> <span className="text-right">PNL (USD)</span></div>
          <div className="flex-1 overflow-hidden relative">
             <div className="absolute inset-0 overflow-y-auto overflow-x-hidden flex flex-col custom-scrollbar">
                {trades.map((t, i) => (<div key={t.id} className={`grid grid-cols-4 text-[11px] px-3 py-2 border-b border-cyan-900/10 items-center ${i === 0 ? 'bg-cyan-500/10 animate-pulse' : 'hover:bg-white/5'}`}><div className="font-mono text-slate-500 opacity-70">{fmtTime(t.time).split('.')[0]}</div><div className="font-bold text-slate-200">{t.pair}</div><div className="text-center"><span className={`px-1.5 py-0.5 text-[9px] rounded font-bold border ${t.side === 'BUY' ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-rose-400 border-rose-500/30 bg-rose-500/10'}`}>{t.side}</span></div><div className={`text-right font-mono font-bold ${t.profit > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{t.profit > 0 ? '+' : ''}{fmt(t.profit)}</div></div>))}
             </div>
          </div>
          <div className="h-1/3 bg-[#0a0a18]/90 border border-cyan-900/30 rounded-sm overflow-hidden p-2 min-h-[150px]">
             <h3 className="text-[10px] font-bold text-cyan-500 border-b border-cyan-900/30 pb-1 mb-2 flex justify-between"><span>TECHNICAL INDICATORS (LIVE)</span><span className="text-slate-500">20/20 ACTIVE</span></h3>
             <div className="grid grid-cols-2 gap-x-4 gap-y-1 overflow-y-auto h-full pb-4 custom-scrollbar">
                {TECH_INDICATORS.map(ind => (<div key={ind} className="flex justify-between items-center text-[9px] border-b border-white/5 py-0.5"><span className="text-slate-300">{ind}</span><div className="flex items-center gap-1"><span className={indicatorSignals[ind] === "BUY" ? "text-green-400 font-bold" : "text-red-400 font-bold"}>{indicatorSignals[ind] || "WAIT"}</span>{indicatorSignals[ind] === "BUY" ? <CheckCircle2 className="w-2 h-2 text-green-500" /> : <XCircle className="w-2 h-2 text-red-500" />}</div></div>))}
             </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');
        .clip-corner { clip-path: polygon(0 0, 100% 0, 100% 80%, 80% 100%, 0 100%); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #0a0a18; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 2px; }
        @keyframes wave { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
        .animate-dots { display: inline-block; animation: wave 1s infinite ease-in-out; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        .animate-spin-slow-3d { animation: spin-3d 8s linear infinite; }
        @keyframes spin-3d { from { transform: rotateY(0deg); } to { transform: rotateY(360deg); } }
        .perspective-500 { perspective: 500px; }
        @keyframes targetMouth { 0% { right: -10%; opacity: 0; transform: scale(1); } 5% { opacity: 1; } 85% { opacity: 1; right: 80%; transform: scale(0.8); } 100% { right: 85%; opacity: 0; transform: scale(0.1); } }
        .coin-target-mouth { animation-name: targetMouth; animation-timing-function: linear; animation-iteration-count: infinite; }
        @keyframes intakeJaw { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(8px) rotate(3deg); } }
        .animate-intake-jaw { animation: intakeJaw 2s ease-in-out infinite; }
        @keyframes pulseSlow { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.95; transform: scale(0.99); } }
        .animate-pulse-slow { animation: pulseSlow 4s ease-in-out infinite; }
        @keyframes snowfall { 0% { transform: translateY(-10vh) translateX(0); opacity: 1; } 100% { transform: translateY(110vh) translateX(20px); opacity: 0; } }
        .animate-snowfall { animation-name: snowfall; animation-timing-function: linear; animation-iteration-count: infinite; }
        @keyframes sway { 0%, 100% { transform: rotate(-10deg); } 50% { transform: rotate(10deg); } }
        .animate-sway { animation: sway 3s ease-in-out infinite; }
        @keyframes bounceIn { 0% { transform: scale(0.3); opacity: 0; } 50% { transform: scale(1.05); opacity: 1; } 70% { transform: scale(0.9); } 100% { transform: scale(1); opacity: 1; } }
        .animate-bounce-in { animation: bounceIn 0.8s cubic-bezier(0.215, 0.610, 0.355, 1.000) both; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fadeIn 1s ease-out forwards; }
        @keyframes zoomIn { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }
        .animate-zoom-in { animation: zoomIn 1s ease-out forwards; }
        @keyframes giftDrop { 0% { transform: translateY(-100px) rotate(0deg); opacity: 1; } 60% { transform: translateY(60vh) rotate(360deg); opacity: 1; } 70% { transform: translateY(58vh) rotate(360deg); opacity: 1; } 80% { transform: translateY(60vh) rotate(360deg); opacity: 1; } 90% { transform: translateY(60vh) scale(1); opacity: 1; } 100% { transform: translateY(60vh) scale(1.2); opacity: 0; } }
        .animate-gift-drop { animation-name: giftDrop; animation-timing-function: ease-in-out; animation-fill-mode: forwards; }
        @keyframes giftReveal { 0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); } 85% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); } 90% { opacity: 1; transform: translate(-50%, -150%) scale(1.2); } 100% { opacity: 0; transform: translate(-50%, -200%) scale(1.5); } }
        .animate-gift-reveal { animation: giftReveal 6s ease-in-out forwards; }
        @keyframes firework { 0% { transform: scale(0); opacity: 1; } 100% { transform: scale(1.5); opacity: 0; } }
        .animate-firework { animation: firework 2s ease-out infinite; }
        @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 20px rgba(6,182,212,0.8); } 50% { box-shadow: 0 0 40px rgba(168,85,247,0.8); } }
        .animate-pulse-glow { animation: pulse-glow 2s infinite; }
        @keyframes bounce-x { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(4px); } }
        .animate-bounce-x { animation: bounce-x 1s infinite; }
      `}} />
    </div>
  );
};

export default MFX45Bot;