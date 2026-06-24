'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useGameStore, Generator, Upgrade, Achievement } from '@/lib/store';
import { formatCookies, formatShort } from '@/lib/utils';
import { audio } from '@/lib/audio';
import * as Icons from 'lucide-react';
import confetti from 'canvas-confetti';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// Dynamic Icon Renderer
const DynamicIcon = ({ name, className }: { name: string; className?: string }) => {
  const IconComponent = (Icons as any)[name];
  if (!IconComponent) return <Icons.Cookie className={className} />;
  return <IconComponent className={className} />;
};

// Interface for floating click texts
interface ClickText {
  id: number;
  x: number;
  y: number;
  text: string;
}

// Interface for falling crumbs
interface Crumb {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  vRotation: number;
  scale: number;
}

export default function CookieClicker() {
  const store = useGameStore();
  
  // Local state for UI
  const [activeTab, setActiveTab] = useState<'bake' | 'shop' | 'stats'>('bake');
  const [isMuted, setIsMuted] = useState(false);
  const [clickTexts, setClickTexts] = useState<ClickText[]>([]);
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  const [offlineModal, setOfflineModal] = useState<{ cookies: number; seconds: number } | null>(null);
  const [showPrestigeConfirm, setShowPrestigeConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  
  // Golden Cookie random placement state
  const [goldenPos, setGoldenPos] = useState({ top: '30%', left: '40%' });
  
  // Click text and crumb ID counters
  const nextTextId = useRef(0);
  const nextCrumbId = useRef(0);
  
  // Cookie element reference for crumb spawning
  const cookieRef = useRef<HTMLButtonElement>(null);

  // Initialize and load game
  useEffect(() => {
    const offlineData = store.loadGame();
    if (offlineData && offlineData.offlineCookies > 0) {
      setOfflineModal({
        cookies: offlineData.offlineCookies,
        seconds: offlineData.offlineSeconds
      });
    }

    // Load mute preference
    const savedMuted = localStorage.getItem('cookie_clicker_muted') === 'true';
    setIsMuted(savedMuted);
    audio.setMuted(savedMuted);

    // Setup Game Tick Loop (10 ticks per second for smooth CPS addition)
    let lastTime = performance.now();
    const gameLoop = (time: number) => {
      const deltaTime = (time - lastTime) / 1000;
      lastTime = time;
      
      // Tick store (deltaTime in seconds)
      store.tick(deltaTime);
      
      requestAnimationFrame(gameLoop);
    };
    
    const animationFrameId = requestAnimationFrame(gameLoop);

    // Setup Golden Cookie Spawner (tries to spawn a golden cookie every 45 to 90 seconds)
    const spawnTimer = setInterval(() => {
      if (!store.goldenCookieActive && Math.random() < 0.4) {
        // Randomize placement
        const top = `${Math.floor(15 + Math.random() * 70)}%`;
        const left = `${Math.floor(10 + Math.random() * 80)}%`;
        setGoldenPos({ top, left });
        store.spawnGoldenCookie();
        audio.playGoldenCookie();
        
        // Auto dismiss after 15 seconds
        setTimeout(() => {
          store.dismissGoldenCookie();
        }, 15000);
      }
    }, 25000);

    // Setup Auto-save every 5 seconds
    const saveTimer = setInterval(() => {
      store.saveGame();
    }, 5000);

    return () => {
      cancelAnimationFrame(animationFrameId);
      clearInterval(spawnTimer);
      clearInterval(saveTimer);
    };
  }, []);

  // Watch achievements to trigger confetti on unlock
  const [unlockedCount, setUnlockedCount] = useState(0);
  useEffect(() => {
    const currentUnlocked = store.achievements.filter((a: any) => a.unlocked).length;
    if (currentUnlocked > unlockedCount) {
      if (unlockedCount > 0) {
        // Trigger confetti!
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.8 },
          colors: ['#f59e0b', '#d97706', '#f5f0eb']
        });
        audio.playAchievement();
      }
      setUnlockedCount(currentUnlocked);
    }
  }, [store.achievements]);

  // Handle giant cookie click
  const handleCookieClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    audio.playClick();
    
    // Gain cookies
    const { gained } = store.clickCookie();

    // Spawn floating text
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    const textId = nextTextId.current++;
    const isClickStorm = store.goldenCookieType === 'click_storm';
    const finalGained = gained;

    setClickTexts((prev: ClickText[]) => [
      ...prev,
      {
        id: textId,
        x: clickX,
        y: clickY,
        text: `+${formatShort(finalGained)}`
      }
    ]);

    // Remove text after animation completes (1s)
    setTimeout(() => {
      setClickTexts((prev: ClickText[]) => prev.filter((t: ClickText) => t.id !== textId));
    }, 1000);

    // Spawn falling crumbs
    const newCrumbs: Crumb[] = [];
    for (let i = 0; i < 6; i++) {
      const crumbId = nextCrumbId.current++;
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3.5;
      newCrumbs.push({
        id: crumbId,
        x: clickX,
        y: clickY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2, // slightly upwards initial boost
        rotation: Math.random() * 360,
        vRotation: (Math.random() - 0.5) * 10,
        scale: 0.5 + Math.random() * 0.6
      });
    }

    setCrumbs((prev: Crumb[]) => [...prev, ...newCrumbs]);

    // Cleanup crumbs after 1.5s
    setTimeout(() => {
      setCrumbs((prev: Crumb[]) => prev.filter((c: Crumb) => !newCrumbs.find((nc: Crumb) => nc.id === c.id)));
    }, 1500);
  };

  // Crumb physics update loop
  useEffect(() => {
    if (crumbs.length === 0) return;

    const gravity = 0.15;
    const interval = setInterval(() => {
      setCrumbs((prev: Crumb[]) => 
        prev.map((c: Crumb) => ({
          ...c,
          x: c.x + c.vx,
          y: c.y + c.vy,
          vy: c.vy + gravity, // apply gravity
          rotation: c.rotation + c.vRotation
        }))
      );
    }, 16); // ~60 FPS physics

    return () => clearInterval(interval);
  }, [crumbs.length]);

  // Handle Golden Cookie click
  const handleGoldenCookieClick = () => {
    const { message, reward } = store.clickGoldenCookie();
    if (message) {
      confetti({
        particleCount: 100,
        spread: 100,
        origin: { x: parseFloat(goldenPos.left) / 100, y: parseFloat(goldenPos.top) / 100 },
        colors: ['#fbbf24', '#f59e0b', '#fff']
      });
      audio.playAchievement();
    }
  };

  // Toggle Mute
  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    audio.setMuted(nextMuted);
    localStorage.setItem('cookie_clicker_muted', String(nextMuted));
  };

  // Trigger Prestige
  const handlePrestige = () => {
    const result = store.prestige();
    if (result) {
      confetti({
        particleCount: 150,
        spread: 120,
        colors: ['#e0f2fe', '#38bdf8', '#0284c7']
      });
      audio.playPrestige();
      setShowPrestigeConfirm(false);
    }
  };

  // Calculate Heavenly Chips gained if prestige now
  const potentialChips = Math.max(0, Math.floor(Math.sqrt(store.totalCookiesBaked / 1e9)) - store.heavenlyChips);

  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground select-none relative overflow-hidden">
      
      {/* Header */}
      <header className="border-b border-border bg-secondary/30 backdrop-blur-md px-4 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <Icons.Cookie className="w-8 h-8 text-primary animate-pulse" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-glow">COSMIC BAKER</h1>
            <p className="text-xs text-muted-foreground">Premium Cookie Clicker</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sound Toggle */}
          <button 
            onClick={toggleMute}
            className="p-2 rounded-lg bg-secondary border border-border hover:bg-muted transition text-muted-foreground hover:text-foreground"
            title={isMuted ? "Unmute sounds" : "Mute sounds"}
          >
            {isMuted ? <Icons.VolumeX className="w-5 h-5" /> : <Icons.Volume2 className="w-5 h-5 text-primary" />}
          </button>

          {/* Reset button */}
          <button 
            onClick={() => setShowResetConfirm(true)}
            className="p-2 rounded-lg bg-red-950/40 border border-red-900/40 hover:bg-red-950/80 transition text-red-400 hover:text-red-300"
            title="Reset game progress"
          >
            <Icons.RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Areas */}
      <main className="flex-1 flex flex-col md:grid md:grid-cols-3 overflow-hidden">
        
        {/* COLUMN 1: Giant Cookie (Left on desktop, always visible or Bake tab on mobile) */}
        <section className={`flex-1 flex flex-col items-center justify-center p-4 border-r border-border relative ${activeTab === 'bake' ? 'flex' : 'hidden md:flex'}`}>
          
          {/* Golden Cookie Spawn */}
          {store.goldenCookieActive && (
            <button
              onClick={handleGoldenCookieClick}
              style={{ top: goldenPos.top, left: goldenPos.left }}
              className="absolute z-20 w-16 h-16 cursor-pointer animate-bounce hover:scale-110 transition-transform focus:outline-none"
            >
              <div className="relative w-full h-full">
                <Icons.Sparkles className="absolute inset-0 w-full h-full text-amber-300 animate-spin opacity-70" />
                <Icons.Cookie className="absolute inset-2 w-12 h-12 text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.8)]" />
              </div>
            </button>
          )}

          {/* Active Buff Timers */}
          {store.goldenCookieType && (
            <div className="absolute top-4 left-4 right-4 flex flex-col gap-2 z-10">
              <div className="bg-amber-950/80 border border-amber-500/30 rounded-lg px-4 py-2 flex items-center justify-between text-amber-300 animate-pulse">
                <div className="flex items-center gap-2">
                  <Icons.Zap className="w-4 h-4 animate-bounce" />
                  <span className="text-sm font-semibold">
                    {store.goldenCookieType === 'frenzy' && '🍪 FRENZY (Production x7)'}
                    {store.goldenCookieType === 'click_storm' && '⚡ CLICK STORM (Clicks x10)'}
                    {store.goldenCookieType === 'lucky' && '🍀 LUCKY BOOST'}
                  </span>
                </div>
                <span className="text-sm font-mono font-bold">{Math.ceil(store.goldenCookieTimer)}s</span>
              </div>
              <div className="w-full bg-secondary h-1 rounded-full overflow-hidden">
                <div 
                  className="bg-amber-500 h-full transition-all duration-100 ease-linear"
                  style={{ width: `${(store.goldenCookieTimer / (store.goldenCookieType === 'frenzy' ? 30 : 15)) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Scoreboard */}
          <div className="text-center mb-8 z-10">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-glow text-primary font-mono mb-1">
              {formatCookies(store.cookies)}
            </h2>
            <p className="text-sm text-muted-foreground font-medium flex items-center justify-center gap-1">
              <span>cookies</span>
              {store.cookiesPerSecond > 0 && (
                <span className="text-amber-400">
                  (+{formatCookies(store.cookiesPerSecond * store.goldenCookieMultiplier)}/s)
                </span>
              )}
            </p>
            {store.heavenlyChips > 0 && (
              <div className="mt-2 inline-flex items-center gap-1 bg-amber-950/30 border border-amber-900/30 px-2 py-0.5 rounded text-xs text-amber-300 font-mono">
                <Icons.Sparkles className="w-3 h-3 text-amber-400" />
                <span>Heavenly Chips: {store.heavenlyChips} (+{store.heavenlyChips * 2}% CPS)</span>
              </div>
            )}
          </div>

          {/* Giant Cookie Button */}
          <div className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center">
            {/* Ambient glows */}
            <div className="absolute w-72 h-72 md:w-96 md:h-96 rounded-full bg-primary/10 blur-3xl animate-pulse-slow" />
            
            <button
              ref={cookieRef}
              onClick={handleCookieClick}
              className="relative w-56 h-56 md:w-72 md:h-72 rounded-full focus:outline-none group transition-transform duration-75 active:scale-95 cursor-pointer"
            >
              {/* Outer spinning aura */}
              <div className="absolute inset-0 rounded-full border-4 border-dashed border-primary/20 group-hover:border-primary/40 animate-cookie-spin" />
              
              {/* Giant Cookie Graphic */}
              <div className="absolute inset-4 rounded-full bg-gradient-to-br from-amber-600 to-amber-950 shadow-2xl flex items-center justify-center border-4 border-amber-800 overflow-hidden cookie-glow group-hover:cookie-glow-hover transition-all duration-300">
                {/* Chocolate Chips */}
                <div className="absolute top-8 left-12 w-6 h-6 rounded-full bg-amber-950 shadow-inner" />
                <div className="absolute top-16 right-16 w-8 h-8 rounded-full bg-amber-950 shadow-inner" />
                <div className="absolute bottom-16 left-16 w-7 h-7 rounded-full bg-amber-950 shadow-inner" />
                <div className="absolute bottom-12 right-12 w-6 h-6 rounded-full bg-amber-950 shadow-inner" />
                <div className="absolute top-32 left-24 w-8 h-8 rounded-full bg-amber-950 shadow-inner" />
                <div className="absolute top-24 right-32 w-5 h-5 rounded-full bg-amber-950 shadow-inner" />
                <div className="absolute bottom-28 right-24 w-7 h-7 rounded-full bg-amber-950 shadow-inner" />
                
                {/* Cookie Texture details */}
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px]" />
                
                {/* Click storm visual overlay */}
                {store.goldenCookieType === 'click_storm' && (
                  <div className="absolute inset-0 bg-yellow-500/20 animate-pulse flex items-center justify-center">
                    <Icons.Zap className="w-24 h-24 text-yellow-400 opacity-60 animate-bounce" />
                  </div>
                )}
              </div>
            </button>

            {/* Click particle numbers */}
            {clickTexts.map(t => (
              <span
                key={t.id}
                style={{ left: t.x, top: t.y }}
                className="absolute text-xl font-black text-amber-300 font-mono pointer-events-none animate-float z-30 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
              >
                {t.text}
              </span>
            ))}

            {/* Cookie Crumbs */}
            {crumbs.map(c => (
              <div
                key={c.id}
                style={{
                  left: c.x,
                  top: c.y,
                  transform: `translate(-50%, -50%) rotate(${c.rotation}deg) scale(${c.scale})`,
                }}
                className="absolute w-3 h-3 bg-amber-900 rounded-sm pointer-events-none z-20"
              />
            ))}
          </div>

          {/* Click Power HUD */}
          <div className="mt-8 text-center text-xs text-muted-foreground bg-secondary/40 border border-border/60 rounded-full px-4 py-1.5 font-mono">
            Click Power: <span className="text-amber-400 font-bold">+{formatCookies(store.clickPower * (store.goldenCookieType === 'click_storm' ? 10 : 1))}</span>
          </div>

        </section>

        {/* COLUMN 2: Shop (Middle on desktop, or Shop tab on mobile) */}
        <section className={`flex-1 flex flex-col p-4 border-r border-border overflow-y-auto ${activeTab === 'shop' ? 'flex' : 'hidden md:flex'}`}>
          <div className="mb-4">
            <h3 className="text-lg font-bold text-glow flex items-center gap-1.5 text-primary">
              <Icons.ShoppingBag className="w-5 h-5" />
              BAKERY SHOP
            </h3>
            <p className="text-xs text-muted-foreground">Invest your cookies to automate and boost production</p>
          </div>

          {/* Upgrades Shelf */}
          {store.upgrades.filter(u => !u.purchased).length > 0 && (
            <div className="mb-6 bg-secondary/20 border border-border/80 rounded-xl p-3">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Available Upgrades</h4>
              <div className="flex flex-wrap gap-2">
                {store.upgrades
                  .filter(u => !u.purchased)
                  .slice(0, 8) // Limit visible upgrades to prevent clutter
                  .map(upg => {
                    const canAfford = store.cookies >= upg.cost;
                    return (
                      <button
                        key={upg.id}
                        onClick={() => {
                          if (canAfford) {
                            store.buyUpgrade(upg.id);
                            audio.playBuy();
                          }
                        }}
                        disabled={!canAfford}
                        className={`group relative p-2.5 rounded-lg border transition-all duration-200 ${
                          canAfford 
                            ? 'bg-amber-950/20 border-amber-500/30 hover:bg-amber-950/40 hover:border-amber-500/60 cursor-pointer' 
                            : 'bg-muted/40 border-border/40 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <DynamicIcon name={upg.icon} className={`w-5 h-5 ${canAfford ? 'text-amber-400' : 'text-muted-foreground'}`} />
                        
                        {/* Custom Tooltip on Hover */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 rounded-lg bg-black/95 border border-amber-900/60 shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-30 text-left text-xs">
                          <p className="font-bold text-amber-400">{upg.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{upg.description}</p>
                          <div className="mt-1.5 pt-1.5 border-t border-amber-950/60 flex items-center justify-between font-mono">
                            <span className="text-emerald-400">Cost:</span>
                            <span className="text-amber-300">{formatShort(upg.cost)} 🍪</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Generators List */}
          <div className="flex-1 flex flex-col gap-2.5">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Generators</h4>
            {store.generators.map(gen => {
              const canAfford = store.cookies >= gen.cost;
              return (
                <button
                  key={gen.id}
                  onClick={() => {
                    if (canAfford) {
                      store.buyGenerator(gen.id);
                      audio.playBuy();
                    }
                  }}
                  disabled={!canAfford}
                  className={`group w-full p-3 rounded-xl border flex items-center justify-between transition-all duration-200 ${
                    canAfford 
                      ? 'bg-secondary/40 border-border hover:bg-secondary/80 hover:border-amber-500/30 cursor-pointer' 
                      : 'bg-muted/10 border-border/20 opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${canAfford ? 'bg-amber-950/40 text-amber-400' : 'bg-muted text-muted-foreground'}`}>
                      <DynamicIcon name={gen.icon} className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-sm text-foreground group-hover:text-amber-300 transition-colors">{gen.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        Cost: <span className={canAfford ? 'text-emerald-400 font-bold' : 'text-muted-foreground'}>{formatShort(gen.cost)} 🍪</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-0.5 font-mono">
                    <span className="text-lg font-bold text-primary">{gen.count}</span>
                    <span className="text-[10px] text-muted-foreground">+{formatCookies(gen.cps)}/s each</span>
                  </div>

                  {/* Tooltip */}
                  <div className="absolute right-4 bottom-auto left-4 md:left-auto md:w-64 p-3 rounded-lg bg-black/95 border border-amber-900/60 shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-30 text-left text-xs">
                    <p className="font-bold text-amber-400">{gen.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{gen.description}</p>
                    <div className="mt-2 pt-2 border-t border-amber-950/60 flex flex-col gap-1 font-mono text-[10px]">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Owned:</span>
                        <span className="text-foreground font-bold">{gen.count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Base CPS:</span>
                        <span className="text-foreground">{formatCookies(gen.cps)}/s</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total CPS contribution:</span>
                        <span className="text-amber-300 font-bold">+{formatCookies(gen.count * gen.cps)}/s</span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* COLUMN 3: Stats & Achievements (Right on desktop, or Stats tab on mobile) */}
        <section className={`flex-1 flex flex-col p-4 overflow-y-auto ${activeTab === 'stats' ? 'flex' : 'hidden md:flex'}`}>
          
          {/* Stats Header */}
          <div className="mb-4">
            <h3 className="text-lg font-bold text-glow flex items-center gap-1.5 text-primary">
              <Icons.BarChart3 className="w-5 h-5" />
              STATISTICS & ASCENSION
            </h3>
            <p className="text-xs text-muted-foreground">Track your progress and ascend to the heavens</p>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-secondary/25 border border-border/80 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Total Cookies Baked</p>
              <p className="text-lg font-bold text-primary font-mono mt-0.5">{formatCookies(store.totalCookiesBaked)}</p>
            </div>
            <div className="bg-secondary/25 border border-border/80 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Total Cookie Clicks</p>
              <p className="text-lg font-bold text-primary font-mono mt-0.5">{store.totalClicks}</p>
            </div>
            <div className="bg-secondary/25 border border-border/80 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Prestige Level</p>
              <p className="text-lg font-bold text-primary font-mono mt-0.5">{store.prestigeLevel}</p>
            </div>
            <div className="bg-secondary/25 border border-border/80 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Golden Cookies Clicked</p>
              <p className="text-lg font-bold text-primary font-mono mt-0.5">{store.goldenCookiesClicked}</p>
            </div>
          </div>

          {/* Live Production Chart */}
          <div className="bg-secondary/20 border border-border/80 rounded-xl p-3 mb-6">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Live Production Graph</h4>
            <div className="h-32 w-full">
              {store.cpsHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={store.cpsHistory}>
                    <XAxis dataKey="time" stroke="#a18276" fontSize={10} tickLine={false} />
                    <YAxis stroke="#a18276" fontSize={10} tickLine={false} width={30} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f0c08', borderColor: '#3e2516' }}
                      labelStyle={{ color: '#a18276' }}
                    />
                    <Line type="monotone" dataKey="cookies" stroke="#d97706" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  Bake some cookies to generate history...
                </div>
              )}
            </div>
          </div>

          {/* Prestige / Ascension Panel */}
          <div className="bg-amber-950/10 border border-amber-900/40 rounded-xl p-4 mb-6">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-sm font-bold text-amber-400 flex items-center gap-1.5">
                  <Icons.Sparkles className="w-4 h-4" />
                  ASCEND (PRESTIGE)
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Reset your progress to unlock permanent speed boosts and heavenly powers.
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between bg-amber-950/30 border border-amber-900/30 rounded-lg p-3 font-mono text-xs">
              <div>
                <p className="text-muted-foreground">Potential Chips:</p>
                <p className="text-lg font-bold text-amber-300">+{potentialChips}</p>
              </div>
              <div className="text-right">
                <p className="text-muted-foreground">Next Chip at:</p>
                <p className="text-foreground font-bold">{formatShort(Math.pow(store.heavenlyChips + potentialChips + 1, 2) * 1e9)} 🍪</p>
              </div>
            </div>

            <button
              onClick={() => setShowPrestigeConfirm(true)}
              disabled={potentialChips <= 0}
              className={`w-full mt-3 py-2.5 rounded-lg font-bold text-xs tracking-wider transition duration-200 ${
                potentialChips > 0
                  ? 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer shadow-lg shadow-amber-950/50'
                  : 'bg-muted/40 border border-border/40 text-muted-foreground cursor-not-allowed'
              }`}
            >
              ASCEND NOW
            </button>
          </div>

          {/* Achievements Panel */}
          <div className="flex-1 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Achievements ({store.achievements.filter((a: any) => a.unlocked).length} / {store.achievements.length})
              </h4>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {store.achievements.map((ach: any) => (
                <div
                  key={ach.id}
                  className={`p-2.5 rounded-xl border flex items-center gap-3 transition-colors duration-200 ${
                    ach.unlocked 
                      ? 'bg-secondary/40 border-amber-500/30' 
                      : 'bg-muted/10 border-border/10 opacity-40'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${ach.unlocked ? 'bg-amber-950/40 text-amber-400' : 'bg-muted text-muted-foreground'}`}>
                    <DynamicIcon name={ach.icon} className="w-5 h-5" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className={`font-bold text-xs truncate ${ach.unlocked ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {ach.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">{ach.description}</p>
                  </div>
                  {ach.unlocked && (
                    <Icons.CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>

        </section>
      </main>

      {/* MOBILE NAVIGATION TABS */}
      <nav className="md:hidden border-t border-border bg-secondary/80 backdrop-blur-md grid grid-cols-3 py-1.5 z-10">
        <button
          onClick={() => setActiveTab('bake')}
          className={`flex flex-col items-center gap-1 py-1 text-xs font-medium transition ${
            activeTab === 'bake' ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          <Icons.Cookie className="w-5 h-5" />
          <span>Bake</span>
        </button>
        <button
          onClick={() => setActiveTab('shop')}
          className={`flex flex-col items-center gap-1 py-1 text-xs font-medium transition ${
            activeTab === 'shop' ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          <Icons.ShoppingBag className="w-5 h-5" />
          <span>Shop</span>
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`flex flex-col items-center gap-1 py-1 text-xs font-medium transition ${
            activeTab === 'stats' ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          <Icons.BarChart3 className="w-5 h-5" />
          <span>Stats</span>
        </button>
      </nav>

      {/* MODAL: Offline Earnings */}
      {offlineModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-secondary border border-amber-900/60 rounded-2xl max-w-md w-full p-6 text-center shadow-2xl relative overflow-hidden">
            {/* Background shimmer */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-primary/20 blur-3xl" />
            
            <Icons.Sparkles className="w-12 h-12 text-amber-400 mx-auto mb-4 animate-spin" />
            
            <h3 className="text-xl font-extrabold text-glow text-primary mb-2">WELCOME BACK!</h3>
            <p className="text-sm text-muted-foreground mb-4">
              While you were away for <span className="text-foreground font-semibold">{(offlineModal.seconds / 3600).toFixed(1)} hours</span>, your automated bakery was hard at work!
            </p>

            <div className="bg-black/40 border border-amber-950/60 rounded-xl p-4 mb-6 font-mono">
              <p className="text-xs text-muted-foreground">Cookies baked:</p>
              <p className="text-2xl font-black text-amber-300 mt-1">+{formatCookies(offlineModal.cookies)} 🍪</p>
            </div>

            <button
              onClick={() => {
                setOfflineModal(null);
                confetti({
                  particleCount: 50,
                  spread: 60,
                  colors: ['#f59e0b', '#d97706']
                });
                audio.playBuy();
              }}
              className="w-full bg-primary hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-amber-950/50 cursor-pointer"
            >
              CLAIM COOKIES
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Prestige Confirmation */}
      {showPrestigeConfirm && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-secondary border border-amber-900/60 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-xl font-extrabold text-amber-400 flex items-center gap-2 mb-2">
              <Icons.Sparkles className="w-6 h-6 text-amber-400 animate-pulse" />
              ASCEND TO THE HEAVENS?
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Ascending will reset your current cookie count, buildings, and upgrades. However, you will gain:
            </p>

            <div className="bg-amber-950/30 border border-amber-900/40 rounded-xl p-4 mb-4 font-mono text-center">
              <p className="text-xs text-muted-foreground">Heavenly Chips gained:</p>
              <p className="text-3xl font-black text-amber-300">+{potentialChips}</p>
              <p className="text-[10px] text-amber-400 mt-1">Permanent multiplier: +{potentialChips * 2}% CPS</p>
            </div>

            <p className="text-xs text-muted-foreground/80 mb-6 italic">
              "Your legacy will live on, stronger, faster, and more delicious than ever before."
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPrestigeConfirm(false)}
                className="flex-1 bg-muted/60 hover:bg-muted border border-border text-foreground font-bold py-2.5 rounded-xl transition cursor-pointer text-xs"
              >
                CANCEL
              </button>
              <button
                onClick={handlePrestige}
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 rounded-xl transition shadow-lg shadow-amber-950/50 cursor-pointer text-xs"
              >
                ASCEND
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Reset Confirmation */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-secondary border border-red-900/40 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-xl font-extrabold text-red-400 flex items-center gap-2 mb-2">
              <Icons.AlertTriangle className="w-6 h-6 text-red-500" />
              WIPE SAVE FILE?
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Are you absolutely sure you want to delete your bakery? This will permanently erase your cookies, upgrades, achievements, and prestige level. This action cannot be undone.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 bg-muted/60 hover:bg-muted border border-border text-foreground font-bold py-2.5 rounded-xl transition cursor-pointer text-xs"
              >
                CANCEL
              </button>
              <button
                onClick={() => {
                  store.resetGame();
                  setShowResetConfirm(false);
                }}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 rounded-xl transition shadow-lg shadow-red-950/50 cursor-pointer text-xs"
              >
                WIPE SAVE
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
