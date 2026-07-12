"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ROAD, STATIONS, Station, StationType, levelFromXp, levelProgress, xpToNext, roadIndexFor,
} from "@/lib/game";
import ProofUpload from "@/components/ProofUpload";
import { X, Zap, MapPin } from "lucide-react";

// ---------- data shapes passed from the server page ----------
export type QuestChallenge = {
  id: string;
  title: string;
  description: string;
  xp: number;
  difficulty: string;
  evidenceRequired: boolean;
  deadline: string;
  station: StationType;
  mine: null | { id: string; progress: number; approvalStatus: string; proofUrl: string | null; xpAwarded: number };
};

export type QuestActivity = {
  id: string;
  title: string;
  description: string;
  points: number;
  date: string;
  location: string | null;
  status: string;
  mine: null | { id: string; approvalStatus: string; proofUrl: string | null; pointsEarned: number };
};

export type QuestReward = { id: string; name: string; description: string; pointsRequired: number; stock: number };
export type QuestHero = { name: string; xp: number; points: number; badges: { icon: string; name: string }[] };
export type QuestLeader = { name: string; xp: number; badges: string[]; isMe: boolean };

type Actions = {
  joinChallenge: (fd: FormData) => Promise<void>;
  updateChallengeProgress: (fd: FormData) => Promise<void>;
  attachChallengeProof: (fd: FormData) => Promise<void>;
  joinActivity: (fd: FormData) => Promise<void>;
  attachProof: (fd: FormData) => Promise<void>;
  redeemReward: (fd: FormData) => Promise<void>;
};

type Props = {
  hero: QuestHero;
  challenges: QuestChallenge[];
  activities: QuestActivity[];
  rewards: QuestReward[];
  leaders: QuestLeader[];
  orgScore: number;
  actions: Actions;
};

// ---------- small game-styled primitives ----------

function GameButton({
  children, tone = "green", disabled, title,
}: {
  children: React.ReactNode;
  tone?: "green" | "amber" | "sky";
  disabled?: boolean;
  title?: string;
}) {
  const tones = {
    green: "from-emerald-500 to-green-600 border-green-800 hover:from-emerald-400",
    amber: "from-amber-400 to-orange-500 border-orange-800 hover:from-amber-300",
    sky: "from-sky-400 to-blue-500 border-blue-800 hover:from-sky-300",
  };
  return (
    <button
      disabled={disabled}
      title={title}
      className={`bg-gradient-to-b ${tones[tone]} text-white text-xs font-bold uppercase tracking-wide px-4 py-2 rounded-xl border-b-4 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-md`}
    >
      {children}
    </button>
  );
}

function QuestChip({ label, tone }: { label: string; tone: "green" | "amber" | "red" | "gray" }) {
  const tones = {
    green: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
    amber: "bg-amber-500/20 text-amber-300 border-amber-500/50",
    red: "bg-rose-500/20 text-rose-300 border-rose-500/50",
    gray: "bg-slate-500/20 text-slate-300 border-slate-500/50",
  };
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${tones[tone]}`}>
      {label}
    </span>
  );
}

const statusTone = (s: string) =>
  s === "APPROVED" ? "green" : s === "REJECTED" ? "red" : "amber";

// ---------- SVG scenery pieces ----------

function Windmill({ x, y, scale = 1, slow = false }: { x: number; y: number; scale?: number; slow?: boolean }) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <rect x="-4" y="-70" width="8" height="70" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
      <g className={slow ? "eco-blades-slow" : "eco-blades"}>
        <circle cx="0" cy="-70" r="4" fill="#64748b" />
        {[0, 120, 240].map((a) => (
          <path key={a} d="M0,-70 L6,-108 L-6,-108 Z" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1" transform={`rotate(${a} 0 -70)`} />
        ))}
      </g>
    </g>
  );
}

function Tree({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <rect x="-3" y="-14" width="6" height="14" fill="#92603d" rx="2" />
      <circle cx="0" cy="-24" r="14" fill="#16a34a" />
      <circle cx="-9" cy="-17" r="9" fill="#22c55e" />
      <circle cx="9" cy="-17" r="9" fill="#15803d" />
    </g>
  );
}

function StationArt({ type }: { type: StationType }) {
  switch (type) {
    case "HOME":
      return (
        <g>
          <rect x="-32" y="-42" width="64" height="42" fill="#fef3c7" stroke="#b45309" strokeWidth="2" rx="3" />
          <path d="M-40,-42 L0,-72 L40,-42 Z" fill="#16a34a" stroke="#166534" strokeWidth="2" />
          <rect x="-9" y="-24" width="18" height="24" fill="#92603d" rx="2" />
          <rect x="14" y="-34" width="12" height="12" fill="#7dd3fc" stroke="#0369a1" />
          <rect x="-26" y="-34" width="12" height="12" fill="#7dd3fc" stroke="#0369a1" />
        </g>
      );
    case "VILLAGE_HALL":
      return (
        <g>
          <rect x="-44" y="-48" width="88" height="48" fill="#dbeafe" stroke="#1d4ed8" strokeWidth="2" rx="3" />
          <path d="M-52,-48 L0,-74 L52,-48 Z" fill="#3b82f6" stroke="#1e40af" strokeWidth="2" />
          <rect x="-10" y="-26" width="20" height="26" fill="#1e40af" rx="2" />
          <text x="0" y="-54" textAnchor="middle" fontSize="16">🤝</text>
        </g>
      );
    case "BIKE_DOCK":
      return (
        <g>
          <rect x="-40" y="-14" width="80" height="14" fill="#a3e635" stroke="#4d7c0f" strokeWidth="2" rx="4" />
          <text x="0" y="-20" textAnchor="middle" fontSize="30">🚲</text>
          <rect x="-30" y="-46" width="60" height="16" fill="#365314" rx="4" />
          <text x="0" y="-34" textAnchor="middle" fontSize="10" fill="#ecfccb" fontWeight="bold">BIKE DOCK</text>
        </g>
      );
    case "SOLAR_FARM":
      return (
        <g>
          {[-30, 2].map((sx) => (
            <g key={sx} transform={`translate(${sx},0)`}>
              <rect x="0" y="-34" width="30" height="20" fill="#1e3a8a" stroke="#172554" strokeWidth="2" rx="2" transform="skewX(-12)" />
              <line x1="12" y1="-14" x2="12" y2="0" stroke="#475569" strokeWidth="3" />
            </g>
          ))}
          <text x="0" y="-44" textAnchor="middle" fontSize="18">☀️</text>
        </g>
      );
    case "RECYCLE_HUB":
      return (
        <g>
          <rect x="-36" y="-40" width="72" height="40" fill="#d1fae5" stroke="#047857" strokeWidth="2" rx="4" />
          <path d="M-42,-40 L0,-60 L42,-40 Z" fill="#10b981" stroke="#047857" strokeWidth="2" />
          <text x="0" y="-12" textAnchor="middle" fontSize="22">♻️</text>
        </g>
      );
    case "TRADING_POST":
      return (
        <g>
          <rect x="-36" y="-38" width="72" height="38" fill="#fee2e2" stroke="#b91c1c" strokeWidth="2" rx="3" />
          <rect x="-42" y="-50" width="84" height="14" fill="#ef4444" rx="3" />
          {[-30, -10, 10, 30].map((sx) => (
            <rect key={sx} x={sx - 7} y="-50" width="14" height="14" fill={sx % 20 === 0 ? "#fecaca" : "#ef4444"} rx="2" />
          ))}
          <text x="0" y="-12" textAnchor="middle" fontSize="20">🛍️</text>
        </g>
      );
    case "HALL_OF_FAME":
      return (
        <g>
          <rect x="-30" y="-16" width="60" height="16" fill="#fbbf24" stroke="#92400e" strokeWidth="2" rx="2" />
          <rect x="-20" y="-30" width="40" height="14" fill="#fcd34d" stroke="#92400e" strokeWidth="2" rx="2" />
          <text x="0" y="-36" textAnchor="middle" fontSize="24">🏆</text>
        </g>
      );
  }
}

// ---------- the character ----------

function Hero({ facing, walking }: { facing: 1 | -1; walking: boolean }) {
  return (
    <g className={walking ? "eco-walking" : "eco-idle"}>
      <ellipse cx="0" cy="4" rx="14" ry="4" fill="rgba(0,0,0,0.25)" />
      <g transform={`scale(${facing},1)`}>
        {/* legs */}
        <rect x="-7" y="-16" width="5" height="16" rx="2.5" fill="#365314" />
        <rect x="2" y="-16" width="5" height="16" rx="2.5" fill="#3f6212" />
        {/* body */}
        <rect x="-10" y="-38" width="20" height="24" rx="7" fill="#16a34a" />
        <rect x="-10" y="-38" width="20" height="10" rx="5" fill="#22c55e" />
        {/* arms */}
        <rect x="-14" y="-36" width="5" height="16" rx="2.5" fill="#15803d" />
        <rect x="9" y="-36" width="5" height="16" rx="2.5" fill="#15803d" />
        {/* head */}
        <circle cx="0" cy="-48" r="11" fill="#fcd9b8" />
        <circle cx="3.5" cy="-50" r="1.6" fill="#1f2937" />
        <path d="M1,-44 Q4,-42 7,-44" stroke="#92400e" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        {/* leaf cap */}
        <path d="M-11,-52 Q0,-64 11,-52 Q0,-58 -11,-52" fill="#15803d" />
        <path d="M0,-58 Q6,-68 12,-64 Q6,-60 2,-56" fill="#22c55e" />
      </g>
    </g>
  );
}

// ---------- main world ----------

export default function QuestWorld({ hero, challenges, activities, rewards, leaders, orgScore, actions }: Props) {
  const [pos, setPos] = useState(ROAD[0]);
  const [facing, setFacing] = useState<1 | -1>(1);
  const [walking, setWalking] = useState(false);
  const [openStation, setOpenStation] = useState<Station | null>(null);
  const [levelUp, setLevelUp] = useState(false);
  const roadIdx = useRef(0);
  const walkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevLevel = useRef(levelFromXp(hero.xp));

  const level = levelFromXp(hero.xp);
  const progress = levelProgress(hero.xp);

  useEffect(() => {
    if (level > prevLevel.current) {
      setLevelUp(true);
      const t = setTimeout(() => setLevelUp(false), 1700);
      prevLevel.current = level;
      return () => clearTimeout(t);
    }
    prevLevel.current = level;
  }, [level]);

  const byStation = (t: StationType) => challenges.filter((c) => c.station === t);
  const markerFor = (t: StationType): string | null => {
    if (t === "VILLAGE_HALL" && activities.some((a) => !a.mine && a.status === "UPCOMING")) return "❗";
    if (["BIKE_DOCK", "SOLAR_FARM", "RECYCLE_HUB", "VILLAGE_HALL"].includes(t)) {
      const list = byStation(t);
      if (list.some((c) => !c.mine)) return "❗";
      if (list.some((c) => c.mine && c.mine.approvalStatus === "PENDING")) return "⏳";
      if (list.length && list.every((c) => c.mine?.approvalStatus === "APPROVED")) return "✅";
    }
    if (t === "TRADING_POST" && rewards.some((r) => r.stock > 0 && hero.points >= r.pointsRequired)) return "🪙";
    return null;
  };

  const walkTo = useCallback((station: Station) => {
    if (walkTimer.current) clearTimeout(walkTimer.current);
    setOpenStation(null);
    const target = roadIndexFor(station.x);
    const start = roadIdx.current;
    if (target === start) {
      setOpenStation(station);
      return;
    }
    const dir = target > start ? 1 : -1;
    setFacing(dir === 1 ? 1 : -1);
    setWalking(true);

    // build waypoint list from current road index to target
    const points: { x: number; y: number }[] = [];
    for (let i = start; i !== target; i += dir) points.push(ROAD[i + dir]);
    const SPEED = 260; // px per second
    const TICK_MS = 28; // timer-driven stepping — rAF can be throttled in embedded/background tabs
    let seg = 0;
    let last = Date.now();
    let cur = { ...ROAD[start] };

    const step = () => {
      const now = Date.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      let remaining = SPEED * dt;
      while (remaining > 0 && seg < points.length) {
        const to = points[seg];
        const dx = to.x - cur.x;
        const dy = to.y - cur.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= remaining) {
          cur = { ...to };
          remaining -= dist;
          seg++;
        } else {
          cur = { x: cur.x + (dx / dist) * remaining, y: cur.y + (dy / dist) * remaining };
          remaining = 0;
        }
      }
      setPos({ ...cur });
      if (seg < points.length) {
        walkTimer.current = setTimeout(step, TICK_MS);
      } else {
        roadIdx.current = target;
        setWalking(false);
        setOpenStation(station);
      }
    };
    walkTimer.current = setTimeout(step, TICK_MS);
  }, []);

  useEffect(
    () => () => {
      if (walkTimer.current) clearTimeout(walkTimer.current);
    },
    []
  );

  const smog = Math.max(0, Math.min(0.4, ((100 - orgScore) / 100) * 0.4));

  return (
    <div className="relative rounded-2xl overflow-hidden border-4 border-emerald-900/40 shadow-2xl select-none">
      {/* ======= HUD ======= */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-3 rounded-2xl bg-slate-900/80 backdrop-blur px-4 py-2.5 text-white shadow-lg">
        <div className="h-11 w-11 rounded-full bg-gradient-to-b from-emerald-400 to-green-600 flex items-center justify-center text-xl border-2 border-emerald-200">
          🧑‍🌾
        </div>
        <div className="min-w-44">
          <div className="flex items-center gap-2 text-sm font-bold">
            {hero.name.split(" ")[0]}
            <span className="rounded-full bg-violet-500/90 px-2 py-0.5 text-[10px] uppercase tracking-wide">
              Lv {level}
            </span>
          </div>
          <div className="mt-1 h-3 w-full rounded-full bg-slate-700 overflow-hidden border border-slate-600">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400 eco-xp-bar transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-[10px] text-slate-300 mt-0.5">
            {hero.xp} XP · {xpToNext(hero.xp)} to Lv {level + 1}
          </div>
        </div>
      </div>

      <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
        <div className="rounded-2xl bg-slate-900/80 backdrop-blur px-4 py-2 text-white shadow-lg flex items-center gap-2">
          <span className="eco-coin text-lg">🪙</span>
          <span className="font-bold text-amber-300">{hero.points}</span>
          <span className="text-[10px] text-slate-400 uppercase">points</span>
        </div>
        <div className="rounded-2xl bg-slate-900/80 backdrop-blur px-3 py-2 text-lg shadow-lg" title={hero.badges.map((b) => b.name).join(", ") || "No badges yet"}>
          {hero.badges.length ? hero.badges.map((b) => b.icon).join(" ") : "🔒"}
        </div>
      </div>

      {/* village air quality = live org ESG score */}
      <div className="absolute bottom-3 left-3 z-20 rounded-xl bg-slate-900/75 backdrop-blur px-3 py-1.5 text-[11px] text-white shadow-lg flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${orgScore >= 70 ? "bg-emerald-400" : orgScore >= 40 ? "bg-amber-400" : "bg-rose-400"}`} />
        Village air quality: <b>{orgScore}/100</b>
        <span className="text-slate-400">— live org ESG score</span>
      </div>

      {levelUp && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div className="eco-levelup text-5xl font-black text-amber-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
            ⭐ LEVEL UP! ⭐
          </div>
        </div>
      )}

      {/* ======= SCENE ======= */}
      <svg viewBox="0 0 1700 640" className="w-full block" style={{ minHeight: 380 }}>
        {/* sky */}
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--sky-top)" />
            <stop offset="100%" stopColor="var(--sky-bottom)" />
          </linearGradient>
        </defs>
        <rect width="1700" height="640" fill="url(#sky)" />

        {/* sun + clouds */}
        <g className="eco-sun">
          <circle cx="1520" cy="95" r="46" fill="#fde047" />
          <circle cx="1520" cy="95" r="62" fill="#fde047" opacity="0.25" />
        </g>
        <g className="eco-cloud" opacity="0.9">
          <ellipse cx="0" cy="90" rx="55" ry="20" fill="white" />
          <ellipse cx="40" cy="80" rx="40" ry="16" fill="white" />
        </g>
        <g className="eco-cloud-2" opacity="0.7">
          <ellipse cx="0" cy="160" rx="65" ry="22" fill="white" />
          <ellipse cx="50" cy="150" rx="45" ry="17" fill="white" />
        </g>

        {/* hills */}
        <path d="M0,430 Q280,300 560,420 T1140,420 T1700,410 V640 H0 Z" fill="var(--hill-far)" />
        <path d="M0,480 Q380,370 760,480 T1700,475 V640 H0 Z" fill="var(--hill-near)" />

        {/* windmills on hills */}
        <Windmill x={240} y={400} scale={0.9} />
        <Windmill x={1050} y={395} scale={1.05} slow />
        <Windmill x={1620} y={402} scale={0.8} slow />

        {/* ground */}
        <path d="M0,520 Q425,495 850,520 T1700,515 V640 H0 Z" fill="var(--ground)" />

        {/* road */}
        <path
          d={`M${ROAD.map((p) => `${p.x},${p.y}`).join(" L")}`}
          fill="none"
          stroke="var(--road)"
          strokeWidth="26"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={`M${ROAD.map((p) => `${p.x},${p.y}`).join(" L")}`}
          fill="none"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth="2.5"
          strokeDasharray="14 12"
        />

        {/* trees */}
        <Tree x={60} y={520} />
        <Tree x={310} y={528} scale={0.8} />
        <Tree x={520} y={518} scale={1.1} />
        <Tree x={760} y={525} scale={0.75} />
        <Tree x={1020} y={520} />
        <Tree x={1275} y={525} scale={0.85} />
        <Tree x={1475} y={518} scale={1.05} />

        {/* stations */}
        {STATIONS.map((s) => {
          const marker = markerFor(s.type);
          return (
            <g
              key={s.type}
              transform={`translate(${s.x},${s.y})`}
              onClick={() => walkTo(s)}
              className="cursor-pointer"
              role="button"
              aria-label={s.name}
            >
              <StationArt type={s.type} />
              {marker && (
                <text className="eco-marker" x="0" y="-84" textAnchor="middle" fontSize="24">
                  {marker}
                </text>
              )}
              <text x="0" y="24" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="white" stroke="rgba(0,0,0,0.45)" strokeWidth="2.5" paintOrder="stroke">
                {s.name}
              </text>
            </g>
          );
        })}

        {/* the hero */}
        <g transform={`translate(${pos.x},${pos.y - 4})`}>
          <Hero facing={facing} walking={walking} />
        </g>

        {/* smog overlay driven by real ESG score */}
        {smog > 0.02 && <rect width="1700" height="640" fill="#57534e" opacity={smog} pointerEvents="none" />}
      </svg>

      {/* ======= QUEST DIALOG ======= */}
      {openStation && (
        <div className="absolute inset-x-0 bottom-0 z-40 p-3 sm:p-5">
          <div className="eco-dialog mx-auto max-w-3xl rounded-2xl border-4 border-amber-700/70 bg-gradient-to-b from-slate-900/95 to-slate-950/95 backdrop-blur text-white shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/60">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-emerald-400" />
                <span className="font-black tracking-wide">{openStation.name}</span>
                <span className="text-xs text-slate-400">— {openStation.tagline}</span>
              </div>
              <button
                onClick={() => setOpenStation(null)}
                className="h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>
            <div className="max-h-[42vh] overflow-y-auto px-5 py-4 space-y-4">
              <StationContent
                station={openStation}
                hero={hero}
                challenges={byStation(openStation.type)}
                activities={activities}
                rewards={rewards}
                leaders={leaders}
                actions={actions}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- per-station dialog content ----------

function StationContent({
  station, hero, challenges, activities, rewards, leaders, actions,
}: {
  station: Station;
  hero: QuestHero;
  challenges: QuestChallenge[];
  activities: QuestActivity[];
  rewards: QuestReward[];
  leaders: QuestLeader[];
  actions: Actions;
}) {
  if (station.type === "HOME") {
    const level = levelFromXp(hero.xp);
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-300">
          Welcome home, <b>{hero.name.split(" ")[0]}</b>! You are a <b>Level {level} Eco Hero</b> with{" "}
          <b className="text-violet-300">{hero.xp} XP</b> and <b className="text-amber-300">{hero.points} points</b> to spend
          at the Trading Post.
        </p>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 mb-1.5">Badge shelf</div>
          {hero.badges.length === 0 ? (
            <p className="text-sm text-slate-400">No badges yet — complete quests around the village to earn them!</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {hero.badges.map((b) => (
                <span key={b.name} className="rounded-xl bg-slate-800 border border-slate-700 px-3 py-1.5 text-sm">
                  {b.icon} {b.name}
                </span>
              ))}
            </div>
          )}
        </div>
        <p className="text-xs text-slate-500">
          Tip: stations with a <span className="text-amber-300">❗</span> have new quests. Proof-based quests need a photo
          before the village council approves them.
        </p>
      </div>
    );
  }

  if (station.type === "TRADING_POST") {
    return (
      <div className="grid sm:grid-cols-2 gap-3">
        {rewards.map((r) => {
          const can = hero.points >= r.pointsRequired && r.stock > 0;
          return (
            <div key={r.id} className="rounded-xl bg-slate-800/80 border border-slate-700 p-3">
              <div className="font-bold text-sm">{r.name}</div>
              <div className="text-xs text-slate-400 mb-2">{r.description}</div>
              <div className="flex items-center justify-between">
                <span className="text-amber-300 font-bold text-sm">🪙 {r.pointsRequired}</span>
                <span className="text-[10px] text-slate-500">{r.stock > 0 ? `${r.stock} left` : "sold out"}</span>
              </div>
              <form action={actions.redeemReward} className="mt-2">
                <input type="hidden" name="rewardId" value={r.id} />
                <GameButton tone="amber" disabled={!can} title={!can ? "Not enough points or out of stock" : undefined}>
                  {r.stock <= 0 ? "Sold out" : can ? "Buy" : "Need more 🪙"}
                </GameButton>
              </form>
            </div>
          );
        })}
        {rewards.length === 0 && <p className="text-sm text-slate-400">The shop is being restocked…</p>}
      </div>
    );
  }

  if (station.type === "HALL_OF_FAME") {
    return (
      <div className="space-y-2">
        {leaders.map((l, i) => (
          <div
            key={l.name + i}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 ${
              l.isMe ? "bg-emerald-500/15 border border-emerald-500/40" : "bg-slate-800/70"
            }`}
          >
            <span className="text-xl w-8 text-center">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
            <span className="font-bold text-sm flex-1">
              {l.name} {l.isMe && <span className="text-emerald-400 text-[10px] uppercase">← you</span>}
            </span>
            <span className="text-base">{l.badges.join(" ")}</span>
            <span className="font-black text-violet-300 text-sm">{l.xp} XP</span>
          </div>
        ))}
      </div>
    );
  }

  if (station.type === "VILLAGE_HALL") {
    return (
      <div className="space-y-4">
        {activities.length > 0 && (
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-wide text-emerald-400 font-bold">Community events (CSR)</div>
            {activities.map((a) => (
              <div key={a.id} className="rounded-xl bg-slate-800/80 border border-slate-700 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-sm">{a.title}</div>
                    <div className="text-xs text-slate-400">
                      {new Date(a.date).toLocaleDateString()} {a.location ? `· ${a.location}` : ""} ·{" "}
                      <span className="text-amber-300 font-bold">+{a.points} 🪙</span>
                    </div>
                  </div>
                  {!a.mine && a.status === "UPCOMING" && (
                    <form action={actions.joinActivity}>
                      <input type="hidden" name="activityId" value={a.id} />
                      <GameButton>Sign up</GameButton>
                    </form>
                  )}
                  {a.mine && (
                    <div className="flex items-center gap-2">
                      <QuestChip label={a.mine.approvalStatus} tone={statusTone(a.mine.approvalStatus)} />
                      {a.mine.approvalStatus === "PENDING" && !a.mine.proofUrl && (
                        <ProofUpload participationId={a.mine.id} action={actions.attachProof} />
                      )}
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1.5">{a.description}</p>
              </div>
            ))}
          </div>
        )}
        <ChallengeList challenges={challenges} actions={actions} emptyText="No community quests posted right now." />
      </div>
    );
  }

  // challenge stations
  return <ChallengeList challenges={challenges} actions={actions} emptyText="No quests here yet — check back soon!" />;
}

function ChallengeList({
  challenges, actions, emptyText,
}: {
  challenges: QuestChallenge[];
  actions: Actions;
  emptyText: string;
}) {
  if (challenges.length === 0) return <p className="text-sm text-slate-400">{emptyText}</p>;
  return (
    <div className="space-y-3">
      <div className="text-xs uppercase tracking-wide text-emerald-400 font-bold">Quests</div>
      {challenges.map((c) => (
        <div key={c.id} className="rounded-xl bg-slate-800/80 border border-slate-700 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-bold text-sm flex items-center gap-2">
                {c.title}
                <span className="inline-flex items-center gap-1 text-violet-300 text-xs font-black">
                  <Zap size={11} /> {c.xp} XP
                </span>
                <QuestChip
                  label={c.difficulty}
                  tone={c.difficulty === "EASY" ? "green" : c.difficulty === "HARD" ? "red" : "amber"}
                />
              </div>
              <div className="text-xs text-slate-400">
                Deadline {new Date(c.deadline).toLocaleDateString()}
                {c.evidenceRequired && " · 📸 proof required"}
              </div>
            </div>
            {!c.mine && (
              <form action={actions.joinChallenge}>
                <input type="hidden" name="challengeId" value={c.id} />
                <GameButton>Accept quest</GameButton>
              </form>
            )}
            {c.mine && <QuestChip label={c.mine.approvalStatus} tone={statusTone(c.mine.approvalStatus)} />}
          </div>
          <p className="text-xs text-slate-400 mt-1.5">{c.description}</p>
          {c.mine && (
            <div className="mt-2.5 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-3 rounded-full bg-slate-700 overflow-hidden border border-slate-600">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-lime-400 transition-all duration-500"
                    style={{ width: `${c.mine.progress}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-emerald-300 w-9">{c.mine.progress}%</span>
              </div>
              {c.mine.approvalStatus === "PENDING" && (
                <div className="flex flex-wrap items-center gap-2.5">
                  <form action={actions.updateChallengeProgress} className="flex items-center gap-1.5">
                    <input type="hidden" name="id" value={c.mine.id} />
                    <input
                      name="progress"
                      type="number"
                      min="0"
                      max="100"
                      defaultValue={c.mine.progress}
                      className="w-18 rounded-lg bg-slate-900 border border-slate-600 px-2 py-1 text-xs text-white"
                    />
                    <GameButton tone="sky">Log progress</GameButton>
                  </form>
                  {!c.mine.proofUrl ? (
                    <ProofUpload participationId={c.mine.id} action={actions.attachChallengeProof} />
                  ) : (
                    <a href={c.mine.proofUrl} target="_blank" className="text-xs text-sky-400 hover:underline">
                      📎 proof attached
                    </a>
                  )}
                </div>
              )}
              {c.mine.approvalStatus === "APPROVED" && (
                <div className="text-xs text-emerald-300 font-bold">Quest complete! +{c.mine.xpAwarded} XP earned ⭐</div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
