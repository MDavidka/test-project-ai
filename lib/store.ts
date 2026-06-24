import { create } from 'zustand';

export interface Generator {
  id: string;
  name: string;
  cost: number;
  baseCost: number;
  count: number;
  cps: number;
  description: string;
  icon: string;
}

export interface Upgrade {
  id: string;
  name: string;
  cost: number;
  purchased: boolean;
  description: string;
  effect: string;
  icon: string;
  type: 'click' | 'multiplier' | 'building';
  buildingId?: string;
  multiplier?: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  icon: string;
}

export interface GameState {
  cookies: number;
  totalCookiesBaked: number;
  totalClicks: number;
  clickPower: number;
  cookiesPerSecond: number;
  prestigeLevel: number;
  heavenlyChips: number;
  lastSaved: number;
  sessionStartTime: number;
  generators: Generator[];
  upgrades: Upgrade[];
  achievements: Achievement[];
  
  // Golden Cookie States
  goldenCookieActive: boolean;
  goldenCookieType: 'frenzy' | 'lucky' | 'click_storm' | null;
  goldenCookieTimer: number; // in seconds
  goldenCookieMultiplier: number; // e.g. 7 for frenzy
  goldenCookieClickMultiplier: number; // e.g. 10 for click storm
  goldenCookiesClicked: number;
  
  // Chart History
  cpsHistory: { time: string; cookies: number; cps: number }[];
  
  // Actions
  clickCookie: () => { gained: number };
  buyGenerator: (id: string) => void;
  buyUpgrade: (id: string) => void;
  tick: (deltaTime: number) => { offlineCookies: number; offlineSeconds: number } | null;
  spawnGoldenCookie: () => void;
  clickGoldenCookie: () => { message: string; reward: number };
  dismissGoldenCookie: () => void;
  prestige: () => { chipsGained: number } | null;
  resetGame: () => void;
  loadGame: () => { offlineCookies: number; offlineSeconds: number } | null;
  saveGame: () => void;
}

const initialGenerators: Generator[] = [
  { id: 'cursor', name: 'Auto-Clicker', cost: 15, baseCost: 15, count: 0, cps: 0.1, description: 'Autoclicks once every 10 seconds.', icon: 'MousePointer' },
  { id: 'grandma', name: 'Grandma', cost: 100, baseCost: 100, count: 0, cps: 1, description: 'A nice grandma to bake more cookies.', icon: 'UserRound' },
  { id: 'farm', name: 'Cookie Farm', cost: 1100, baseCost: 1100, count: 0, cps: 8, description: 'Grows cookie plants from cookie seeds.', icon: 'Sprout' },
  { id: 'mine', name: 'Cookie Mine', cost: 12000, baseCost: 12000, count: 0, cps: 47, description: 'Mines cookie dough from the earth.', icon: 'Pickaxe' },
  { id: 'factory', name: 'Cookie Factory', cost: 130000, baseCost: 130000, count: 0, cps: 260, description: 'Mass produces cookies on assembly lines.', icon: 'Factory' },
  { id: 'bank', name: 'Cookie Bank', cost: 1400000, baseCost: 1400000, count: 0, cps: 1400, description: 'Generates interest on cookie deposits.', icon: 'Coins' },
  { id: 'temple', name: 'Cookie Temple', cost: 20000000, baseCost: 20000000, count: 0, cps: 7800, description: 'Full of chocolatey, ancient relics.', icon: 'Church' },
  { id: 'wizard_tower', name: 'Wizard Tower', cost: 330000000, baseCost: 330000000, count: 0, cps: 44000, description: 'Summons cookies from the magic dimension.', icon: 'Sparkles' },
  { id: 'shipment', name: 'Cookie Shipment', cost: 5100000000, baseCost: 5100000000, count: 0, cps: 260000, description: 'Brings cookies from the Cookie Planet.', icon: 'Rocket' },
  { id: 'alchemy_lab', name: 'Alchemy Lab', cost: 75000000000, baseCost: 75000000000, count: 0, cps: 1600000, description: 'Transmutes gold directly into cookies.', icon: 'FlaskConical' },
  { id: 'portal', name: 'Cookie Portal', cost: 1000000000000, baseCost: 1000000000000, count: 0, cps: 10000000, description: 'Opens a gateway to the Cookieverse.', icon: 'DoorOpen' },
  { id: 'time_machine', name: 'Time Machine', cost: 14000000000000, baseCost: 14000000000000, count: 0, cps: 65000000, description: 'Brings back cookies from before they were eaten.', icon: 'Clock' },
];

const initialUpgrades: Upgrade[] = [
  { id: 'reinforced_finger', name: 'Reinforced Finger', cost: 100, purchased: false, description: 'Cookies per click +1.', effect: 'Clicking gains +1 cookie.', icon: 'MousePointerClick', type: 'click', multiplier: 1 },
  { id: 'carpal_tunnel', name: 'Carpal Tunnel Prevention', cost: 500, purchased: false, description: 'Cookies per click +3.', effect: 'Clicking gains +3 cookies.', icon: 'ShieldAlert', type: 'click', multiplier: 3 },
  { id: 'ambidextrous', name: 'Ambidextrous Clicking', cost: 5000, purchased: false, description: 'Cookies per click x2.', effect: 'Doubles click power.', icon: 'Shuffle', type: 'click', multiplier: 2 },
  { id: 'steel_mouse', name: 'Steel Plated Mouse', cost: 50000, purchased: false, description: 'Cookies per click +50.', effect: 'Clicking gains +50 cookies.', icon: 'Laptop', type: 'click', multiplier: 50 },
  { id: 'golden_mouse', name: 'Golden Mouse', cost: 500000, purchased: false, description: 'Cookies per click x3.', effect: 'Triples click power.', icon: 'Award', type: 'click', multiplier: 3 },
  { id: 'quantum_mouse', name: 'Quantum Mouse', cost: 15000000, purchased: false, description: 'Cookies per click +1,000.', effect: 'Clicking gains +1000 cookies.', icon: 'Cpu', type: 'click', multiplier: 1000 },
  
  { id: 'grandma_baking_powder', name: 'Baking Powder', cost: 1000, purchased: false, description: 'Grandmas are twice as efficient.', effect: 'Grandma CPS x2', icon: 'UserRoundPlus', type: 'building', buildingId: 'grandma', multiplier: 2 },
  { id: 'fertilizer_plus', name: 'Rich Soil Fertilizer', cost: 10000, purchased: false, description: 'Cookie Farms are twice as efficient.', effect: 'Farm CPS x2', icon: 'Sprout', type: 'building', buildingId: 'farm', multiplier: 2 },
  { id: 'diamond_drill', name: 'Diamond-Tipped Drills', cost: 150000, purchased: false, description: 'Cookie Mines are twice as efficient.', effect: 'Mine CPS x2', icon: 'Pickaxe', type: 'building', buildingId: 'mine', multiplier: 2 },
  { id: 'steam_turbines', name: 'Steam-Powered Turbines', cost: 1500000, purchased: false, description: 'Factories are twice as efficient.', effect: 'Factory CPS x2', icon: 'Wrench', type: 'building', buildingId: 'factory', multiplier: 2 },
  { id: 'hyper_inflation', name: 'Aggressive Investments', cost: 20000000, purchased: false, description: 'Cookie Banks are twice as efficient.', effect: 'Bank CPS x2', icon: 'TrendingUp', type: 'building', buildingId: 'bank', multiplier: 2 },
  { id: 'magic_catalyst', name: 'Mana Infusion', cost: 500000000, purchased: false, description: 'Wizard Towers are twice as efficient.', effect: 'Wizard Tower CPS x2', icon: 'Sparkles', type: 'building', buildingId: 'wizard_tower', multiplier: 2 },
];

const initialAchievements: Achievement[] = [
  { id: 'first_cookie', name: 'Wake and Bake', description: 'Bake your first cookie.', unlocked: false, icon: 'Cookie' },
  { id: 'hundred_cookies', name: 'Making Dough', description: 'Bake 100 cookies all-time.', unlocked: false, icon: 'Flame' },
  { id: 'ten_thousand_cookies', name: 'Cookie Monster', description: 'Bake 10,000 cookies all-time.', unlocked: false, icon: 'Smile' },
  { id: 'million_cookies', name: 'Cookie Overlord', description: 'Bake 1,000,000 cookies all-time.', unlocked: false, icon: 'Crown' },
  { id: 'click_10', name: 'Finger Workout', description: 'Click the giant cookie 10 times.', unlocked: false, icon: 'Activity' },
  { id: 'click_100', name: 'Click Happy', description: 'Click the giant cookie 100 times.', unlocked: false, icon: 'Zap' },
  { id: 'click_1000', name: 'Click Master', description: 'Click the giant cookie 1,000 times.', unlocked: false, icon: 'Swords' },
  { id: 'own_5_grandmas', name: "Grandma's Friend", description: 'Own 5 Grandmas.', unlocked: false, icon: 'Heart' },
  { id: 'own_25_grandmas', name: 'Retirement Home', description: 'Own 25 Grandmas.', unlocked: false, icon: 'Users' },
  { id: 'own_10_factories', name: 'Industrial Age', description: 'Own 10 Factories.', unlocked: false, icon: 'Factory' },
  { id: 'own_1_time_machine', name: 'Time Bender', description: 'Own 1 Time Machine.', unlocked: false, icon: 'Timer' },
  { id: 'golden_click', name: 'Golden Touch', description: 'Click a Golden Cookie.', unlocked: false, icon: 'Sparkles' },
  { id: 'first_prestige', name: 'Prestige Pioneer', description: 'Reset your bakery with at least 1 Heavenly Chip.', unlocked: false, icon: 'Sparkles' },
];

// Helper to calculate total CPS and Click Power
const recalculateCPSAndClick = (generators: Generator[], upgrades: Upgrade[], heavenlyChips: number) => {
  // 1. Calculate Base CPS
  let baseCps = 0;
  generators.forEach(gen => {
    let genCps = gen.cps;
    // Apply building-specific upgrades
    upgrades.forEach(upg => {
      if (upg.purchased && upg.type === 'building' && upg.buildingId === gen.id && upg.multiplier) {
        genCps *= upg.multiplier;
      }
    });
    baseCps += gen.count * genCps;
  });

  // Apply prestige multiplier (+2% per heavenly chip)
  const prestigeMultiplier = 1 + (heavenlyChips * 0.02);
  const finalCps = baseCps * prestigeMultiplier;

  // 2. Calculate Click Power
  let baseClickPower = 1;
  upgrades.forEach(upg => {
    if (upg.purchased && upg.type === 'click') {
      if (upg.id === 'reinforced_finger') baseClickPower += 1;
      else if (upg.id === 'carpal_tunnel') baseClickPower += 3;
      else if (upg.id === 'steel_mouse') baseClickPower += 50;
      else if (upg.id === 'quantum_mouse') baseClickPower += 1000;
    }
  });

  // Apply click multipliers
  upgrades.forEach(upg => {
    if (upg.purchased && upg.type === 'click') {
      if (upg.id === 'ambidextrous') baseClickPower *= 2;
      else if (upg.id === 'golden_mouse') baseClickPower *= 3;
    }
  });

  return { cps: finalCps, clickPower: baseClickPower };
};

// Check achievements
const checkAchievements = (cookiesBaked: number, clicks: number, generators: Generator[], activeChips: number, unlockedAchievements: string[]) => {
  const newlyUnlocked: string[] = [];

  const checkAndUnlock = (id: string) => {
    if (!unlockedAchievements.includes(id)) {
      newlyUnlocked.push(id);
    }
  };

  if (cookiesBaked >= 1) checkAndUnlock('first_cookie');
  if (cookiesBaked >= 100) checkAndUnlock('hundred_cookies');
  if (cookiesBaked >= 10000) checkAndUnlock('ten_thousand_cookies');
  if (cookiesBaked >= 1000000) checkAndUnlock('million_cookies');

  if (clicks >= 10) checkAndUnlock('click_10');
  if (clicks >= 100) checkAndUnlock('click_100');
  if (clicks >= 1000) checkAndUnlock('click_1000');

  const grandmas = generators.find(g => g.id === 'grandma')?.count || 0;
  if (grandmas >= 5) checkAndUnlock('own_5_grandmas');
  if (grandmas >= 25) checkAndUnlock('own_25_grandmas');

  const factories = generators.find(g => g.id === 'factory')?.count || 0;
  if (factories >= 10) checkAndUnlock('own_10_factories');

  const timeMachines = generators.find(g => g.id === 'time_machine')?.count || 0;
  if (timeMachines >= 1) checkAndUnlock('own_1_time_machine');

  return newlyUnlocked;
};

export const useGameStore = create<GameState>((set, get) => ({
  cookies: 0,
  totalCookiesBaked: 0,
  totalClicks: 0,
  clickPower: 1,
  cookiesPerSecond: 0,
  prestigeLevel: 0,
  heavenlyChips: 0,
  lastSaved: Date.now(),
  sessionStartTime: Date.now(),
  generators: initialGenerators,
  upgrades: initialUpgrades,
  achievements: initialAchievements,
  
  goldenCookieActive: false,
  goldenCookieType: null,
  goldenCookieTimer: 0,
  goldenCookieMultiplier: 1,
  goldenCookieClickMultiplier: 1,
  goldenCookiesClicked: 0,
  
  cpsHistory: [],

  clickCookie: () => {
    const state = get();
    const isClickStorm = state.goldenCookieType === 'click_storm';
    const currentClickPower = state.clickPower * (isClickStorm ? 10 : 1) * state.goldenCookieMultiplier;
    
    const newCookies = state.cookies + currentClickPower;
    const newTotalBaked = state.totalCookiesBaked + currentClickPower;
    const newClicks = state.totalClicks + 1;

    // Check achievements
    const unlockedIds = state.achievements.filter(a => a.unlocked).map(a => a.id);
    const newlyUnlocked = checkAchievements(newTotalBaked, newClicks, state.generators, state.heavenlyChips, unlockedIds);

    let updatedAchievements = state.achievements;
    if (newlyUnlocked.length > 0) {
      updatedAchievements = state.achievements.map(ach => 
        newlyUnlocked.includes(ach.id) ? { ...ach, unlocked: true } : ach
      );
    }

    set({
      cookies: newCookies,
      totalCookiesBaked: newTotalBaked,
      totalClicks: newClicks,
      achievements: updatedAchievements
    });

    return { gained: currentClickPower };
  },

  buyGenerator: (id) => {
    const state = get();
    const generatorIndex = state.generators.findIndex(g => g.id === id);
    if (generatorIndex === -1) return;

    const generator = state.generators[generatorIndex];
    if (state.cookies < generator.cost) return;

    const newCookies = state.cookies - generator.cost;
    const newCount = generator.count + 1;
    const newCost = Math.floor(generator.baseCost * Math.pow(1.15, newCount));

    const updatedGenerators = [...state.generators];
    updatedGenerators[generatorIndex] = {
      ...generator,
      count: newCount,
      cost: newCost,
    };

    const { cps, clickPower } = recalculateCPSAndClick(updatedGenerators, state.upgrades, state.heavenlyChips);

    // Check achievements
    const unlockedIds = state.achievements.filter(a => a.unlocked).map(a => a.id);
    const newlyUnlocked = checkAchievements(state.totalCookiesBaked, state.totalClicks, updatedGenerators, state.heavenlyChips, unlockedIds);

    let updatedAchievements = state.achievements;
    if (newlyUnlocked.length > 0) {
      updatedAchievements = state.achievements.map(ach => 
        newlyUnlocked.includes(ach.id) ? { ...ach, unlocked: true } : ach
      );
    }

    set({
      cookies: newCookies,
      generators: updatedGenerators,
      cookiesPerSecond: cps,
      clickPower: clickPower,
      achievements: updatedAchievements
    });
  },

  buyUpgrade: (id) => {
    const state = get();
    const upgradeIndex = state.upgrades.findIndex(u => u.id === id);
    if (upgradeIndex === -1) return;

    const upgrade = state.upgrades[upgradeIndex];
    if (state.cookies < upgrade.cost || upgrade.purchased) return;

    const newCookies = state.cookies - upgrade.cost;
    const updatedUpgrades = [...state.upgrades];
    updatedUpgrades[upgradeIndex] = {
      ...upgrade,
      purchased: true,
    };

    const { cps, clickPower } = recalculateCPSAndClick(state.generators, updatedUpgrades, state.heavenlyChips);

    set({
      cookies: newCookies,
      upgrades: updatedUpgrades,
      cookiesPerSecond: cps,
      clickPower: clickPower,
    });
  },

  tick: (deltaTime) => {
    const state = get();
    
    // Golden cookie timer tick
    let nextGoldenCookieActive = state.goldenCookieActive;
    let nextGoldenCookieType = state.goldenCookieType;
    let nextGoldenCookieTimer = state.goldenCookieTimer;
    let nextGoldenCookieMultiplier = state.goldenCookieMultiplier;
    let nextGoldenCookieClickMultiplier = state.goldenCookieClickMultiplier;

    if (state.goldenCookieType) {
      nextGoldenCookieTimer = Math.max(0, state.goldenCookieTimer - deltaTime);
      if (nextGoldenCookieTimer === 0) {
        nextGoldenCookieType = null;
        nextGoldenCookieMultiplier = 1;
        nextGoldenCookieClickMultiplier = 1;
      }
    }

    // Passive cookies generation
    const currentCPS = state.cookiesPerSecond * nextGoldenCookieMultiplier;
    const generatedCookies = currentCPS * deltaTime;
    
    if (generatedCookies === 0 && !state.goldenCookieType) {
      return null;
    }

    const newCookies = state.cookies + generatedCookies;
    const newTotalBaked = state.totalCookiesBaked + generatedCookies;

    // Check achievements
    const unlockedIds = state.achievements.filter(a => a.unlocked).map(a => a.id);
    const newlyUnlocked = checkAchievements(newTotalBaked, state.totalClicks, state.generators, state.heavenlyChips, unlockedIds);

    let updatedAchievements = state.achievements;
    if (newlyUnlocked.length > 0) {
      updatedAchievements = state.achievements.map(ach => 
        newlyUnlocked.includes(ach.id) ? { ...ach, unlocked: true } : ach
      );
    }

    // Chart history: append every 5 seconds or so
    let updatedHistory = [...state.cpsHistory];
    const nowSec = Math.floor((Date.now() - state.sessionStartTime) / 1000);
    if (nowSec % 5 === 0 && (updatedHistory.length === 0 || updatedHistory[updatedHistory.length - 1].time !== `${nowSec}s`)) {
      updatedHistory.push({
        time: `${nowSec}s`,
        cookies: Math.floor(newCookies),
        cps: currentCPS
      });
      // Limit history to last 15 points
      if (updatedHistory.length > 15) {
        updatedHistory.shift();
      }
    }

    set({
      cookies: newCookies,
      totalCookiesBaked: newTotalBaked,
      goldenCookieType: nextGoldenCookieType,
      goldenCookieTimer: nextGoldenCookieTimer,
      goldenCookieMultiplier: nextGoldenCookieMultiplier,
      goldenCookieClickMultiplier: nextGoldenCookieClickMultiplier,
      achievements: updatedAchievements,
      cpsHistory: updatedHistory,
      lastSaved: Date.now()
    });

    return null;
  },

  spawnGoldenCookie: () => {
    set({ goldenCookieActive: true });
  },

  clickGoldenCookie: () => {
    const state = get();
    if (!state.goldenCookieActive) return { message: '', reward: 0 };

    const types: ('frenzy' | 'lucky' | 'click_storm')[] = ['frenzy', 'lucky', 'click_storm'];
    const selectedType = types[Math.floor(Math.random() * types.length)];
    
    let message = '';
    let reward = 0;
    
    let nextMultiplier = 1;
    let nextClickMultiplier = 1;
    let nextTimer = 0;

    if (selectedType === 'frenzy') {
      nextMultiplier = 7;
      nextTimer = 30;
      message = 'Frenzy! Production x7 for 30s!';
    } else if (selectedType === 'lucky') {
      // Lucky! gives instant cookies
      const currentCPS = state.cookiesPerSecond || 1;
      reward = Math.min(state.cookies * 0.15 + 13, currentCPS * 900 + 13);
      message = `Lucky! Gained +${Math.floor(reward)} cookies!`;
    } else if (selectedType === 'click_storm') {
      nextClickMultiplier = 10;
      nextTimer = 15;
      message = 'Click Storm! Clicks x10 for 15s!';
    }

    // Check golden click achievements
    const newGoldenClicks = state.goldenCookiesClicked + 1;
    const unlockedIds = state.achievements.filter(a => a.unlocked).map(a => a.id);
    
    let updatedAchievements = state.achievements;
    if (newGoldenClicks >= 1 && !unlockedIds.includes('golden_click')) {
      updatedAchievements = state.achievements.map(ach => 
        ach.id === 'golden_click' ? { ...ach, unlocked: true } : ach
      );
    }

    set({
      cookies: state.cookies + reward,
      totalCookiesBaked: state.totalCookiesBaked + reward,
      goldenCookieActive: false,
      goldenCookieType: selectedType,
      goldenCookieTimer: nextTimer,
      goldenCookieMultiplier: nextMultiplier,
      goldenCookieClickMultiplier: nextClickMultiplier,
      goldenCookiesClicked: newGoldenClicks,
      achievements: updatedAchievements
    });

    return { message, reward };
  },

  dismissGoldenCookie: () => {
    set({ goldenCookieActive: false });
  },

  prestige: () => {
    const state = get();
    // Formula for Heavenly Chips based on total cookies baked all time
    // 1 billion cookies minimum for first chip
    if (state.totalCookiesBaked < 1e9) return null;

    // Chips = sqrt(total / 1e9)
    const totalChips = Math.floor(Math.sqrt(state.totalCookiesBaked / 1e9));
    const chipsGained = Math.max(0, totalChips - state.heavenlyChips);

    if (chipsGained <= 0) return null;

    // Reset everything except total baked, total clicks, achievements, heavenly chips, golden clicks
    const resetGenerators = initialGenerators.map(g => ({ ...g }));
    const resetUpgrades = initialUpgrades.map(u => ({ ...u }));
    
    const newPrestigeLevel = state.prestigeLevel + 1;
    const newHeavenlyChips = state.heavenlyChips + chipsGained;

    const { cps, clickPower } = recalculateCPSAndClick(resetGenerators, resetUpgrades, newHeavenlyChips);

    // Check prestige achievement
    const unlockedIds = state.achievements.filter(a => a.unlocked).map(a => a.id);
    let updatedAchievements = state.achievements;
    if (!unlockedIds.includes('first_prestige')) {
      updatedAchievements = state.achievements.map(ach => 
        ach.id === 'first_prestige' ? { ...ach, unlocked: true } : ach
      );
    }

    set({
      cookies: 0,
      generators: resetGenerators,
      upgrades: resetUpgrades,
      prestigeLevel: newPrestigeLevel,
      heavenlyChips: newHeavenlyChips,
      cookiesPerSecond: cps,
      clickPower: clickPower,
      achievements: updatedAchievements,
      cpsHistory: [],
    });

    return { chipsGained };
  },

  resetGame: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('cookie_clicker_save');
    }
    set({
      cookies: 0,
      totalCookiesBaked: 0,
      totalClicks: 0,
      clickPower: 1,
      cookiesPerSecond: 0,
      prestigeLevel: 0,
      heavenlyChips: 0,
      lastSaved: Date.now(),
      sessionStartTime: Date.now(),
      generators: initialGenerators.map(g => ({ ...g })),
      upgrades: initialUpgrades.map(u => ({ ...u })),
      achievements: initialAchievements.map(a => ({ ...a })),
      goldenCookieActive: false,
      goldenCookieType: null,
      goldenCookieTimer: 0,
      goldenCookieMultiplier: 1,
      goldenCookieClickMultiplier: 1,
      goldenCookiesClicked: 0,
      cpsHistory: [],
    });
  },

  loadGame: () => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem('cookie_clicker_save');
      if (!saved) return null;

      const parsed = JSON.parse(saved);
      
      // Merge with initial lists to handle potential updates or missing props
      const loadedGenerators = initialGenerators.map(initial => {
        const savedGen = parsed.generators?.find((g: any) => g.id === initial.id);
        if (savedGen) {
          return {
            ...initial,
            count: savedGen.count ?? 0,
            cost: savedGen.cost ?? initial.baseCost,
          };
        }
        return initial;
      });

      const loadedUpgrades = initialUpgrades.map(initial => {
        const savedUpg = parsed.upgrades?.find((u: any) => u.id === initial.id);
        if (savedUpg) {
          return {
            ...initial,
            purchased: savedUpg.purchased ?? false,
          };
        }
        return initial;
      });

      const loadedAchievements = initialAchievements.map(initial => {
        const savedAch = parsed.achievements?.find((a: any) => a.id === initial.id);
        if (savedAch) {
          return {
            ...initial,
            unlocked: savedAch.unlocked ?? false,
          };
        }
        return initial;
      });

      const heavenlyChips = parsed.heavenlyChips ?? 0;
      const { cps, clickPower } = recalculateCPSAndClick(loadedGenerators, loadedUpgrades, heavenlyChips);

      const lastSavedTime = parsed.lastSaved ?? Date.now();
      const offlineSeconds = Math.max(0, Math.floor((Date.now() - lastSavedTime) / 1000));
      
      // Calculate offline cookies (cap offline time to 12 hours = 43200 seconds to prevent crazy cheese)
      const cappedOfflineSecs = Math.min(offlineSeconds, 43200);
      const offlineCookies = cappedOfflineSecs * cps;

      set({
        cookies: (parsed.cookies ?? 0) + offlineCookies,
        totalCookiesBaked: (parsed.totalCookiesBaked ?? 0) + offlineCookies,
        totalClicks: parsed.totalClicks ?? 0,
        clickPower: clickPower,
        cookiesPerSecond: cps,
        prestigeLevel: parsed.prestigeLevel ?? 0,
        heavenlyChips: heavenlyChips,
        lastSaved: Date.now(),
        sessionStartTime: parsed.sessionStartTime ?? Date.now(),
        generators: loadedGenerators,
        upgrades: loadedUpgrades,
        achievements: loadedAchievements,
        goldenCookiesClicked: parsed.goldenCookiesClicked ?? 0,
        cpsHistory: parsed.cpsHistory ?? [],
      });

      if (offlineCookies > 0) {
        return { offlineCookies, offlineSeconds: offlineSeconds };
      }
    } catch (e) {
      console.error('Error loading cookie clicker save', e);
    }
    return null;
  },

  saveGame: () => {
    const state = get();
    if (typeof window === 'undefined') return;
    try {
      const saveState = {
        cookies: state.cookies,
        totalCookiesBaked: state.totalCookiesBaked,
        totalClicks: state.totalClicks,
        prestigeLevel: state.prestigeLevel,
        heavenlyChips: state.heavenlyChips,
        lastSaved: Date.now(),
        sessionStartTime: state.sessionStartTime,
        generators: state.generators.map(g => ({ id: g.id, count: g.count, cost: g.cost })),
        upgrades: state.upgrades.map(u => ({ id: u.id, purchased: u.purchased })),
        achievements: state.achievements.map(a => ({ id: a.id, unlocked: a.unlocked })),
        goldenCookiesClicked: state.goldenCookiesClicked,
        cpsHistory: state.cpsHistory,
      };
      localStorage.setItem('cookie_clicker_save', JSON.stringify(saveState));
    } catch (e) {
      console.error('Error saving cookie clicker game', e);
    }
  },
}));
