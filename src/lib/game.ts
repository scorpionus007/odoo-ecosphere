// EcoQuest game-layer helpers: leveling math and world-station layout.

export const XP_PER_LEVEL = 150;

export function levelFromXp(xp: number) {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

export function levelProgress(xp: number) {
  return Math.round(((xp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100);
}

export function xpToNext(xp: number) {
  return XP_PER_LEVEL - (xp % XP_PER_LEVEL);
}

export type StationType =
  | "HOME"
  | "VILLAGE_HALL"
  | "BIKE_DOCK"
  | "SOLAR_FARM"
  | "RECYCLE_HUB"
  | "TRADING_POST"
  | "HALL_OF_FAME";

export type Station = {
  type: StationType;
  name: string;
  tagline: string;
  x: number; // scene coordinates (viewBox 1600x640)
  y: number;
};

// Stations along the village road, left → right.
export const STATIONS: Station[] = [
  { type: "HOME", name: "My Eco Home", tagline: "Your stats, badges & level", x: 130, y: 500 },
  { type: "VILLAGE_HALL", name: "Village Hall", tagline: "CSR community quests", x: 400, y: 480 },
  { type: "BIKE_DOCK", name: "Bike Dock", tagline: "Green commute quests", x: 665, y: 505 },
  { type: "SOLAR_FARM", name: "Solar Farm", tagline: "Energy saver quests", x: 930, y: 480 },
  { type: "RECYCLE_HUB", name: "Recycle Hub", tagline: "Zero waste quests", x: 1180, y: 505 },
  { type: "TRADING_POST", name: "Trading Post", tagline: "Spend points on rewards", x: 1395, y: 485 },
  { type: "HALL_OF_FAME", name: "Hall of Fame", tagline: "Village leaderboard", x: 1555, y: 505 },
];

/** Category name → station that hosts its challenges. */
export function stationForCategory(categoryName: string): StationType {
  const n = categoryName.toLowerCase();
  if (n.includes("commute") || n.includes("transport") || n.includes("travel")) return "BIKE_DOCK";
  if (n.includes("energy") || n.includes("power") || n.includes("electric")) return "SOLAR_FARM";
  if (n.includes("waste") || n.includes("recycl") || n.includes("plastic")) return "RECYCLE_HUB";
  return "VILLAGE_HALL";
}

/** Road waypoints the character walks along (piecewise linear, matches the drawn road). */
export const ROAD: { x: number; y: number }[] = [
  { x: 130, y: 545 },
  { x: 280, y: 555 },
  { x: 400, y: 540 },
  { x: 540, y: 555 },
  { x: 665, y: 550 },
  { x: 800, y: 540 },
  { x: 930, y: 550 },
  { x: 1060, y: 555 },
  { x: 1180, y: 548 },
  { x: 1300, y: 552 },
  { x: 1395, y: 545 },
  { x: 1480, y: 550 },
  { x: 1555, y: 548 },
];

/** Index of the road waypoint nearest a station (walk target). */
export function roadIndexFor(stationX: number) {
  let best = 0;
  let bestD = Infinity;
  ROAD.forEach((p, i) => {
    const d = Math.abs(p.x - stationX);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}
