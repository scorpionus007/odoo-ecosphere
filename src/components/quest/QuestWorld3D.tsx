"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { StationType, levelFromXp, levelProgress, xpToNext } from "@/lib/game";
import ProofUpload from "@/components/ProofUpload";
import { X, Zap, MapPin, HelpCircle, Copy, Check } from "lucide-react";

// ================= data shapes =================
export type QuestChallenge = {
  id: string; title: string; description: string; xp: number; difficulty: string;
  evidenceRequired: boolean; deadline: string; station: StationType;
  mine: null | { id: string; progress: number; approvalStatus: string; proofUrl: string | null; xpAwarded: number };
};
export type QuestActivity = {
  id: string; title: string; description: string; points: number; date: string;
  location: string | null; status: string;
  mine: null | { id: string; approvalStatus: string; proofUrl: string | null; pointsEarned: number };
};
export type QuestReward = {
  id: string; name: string; description: string; type: string; brand: string | null;
  pointsRequired: number; stock: number;
};
export type QuestRedemption = {
  id: string; rewardName: string; type: string; pointsSpent: number;
  voucherCode: string | null; redeemedAt: string;
};
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
  hero: QuestHero; challenges: QuestChallenge[]; activities: QuestActivity[];
  rewards: QuestReward[]; leaders: QuestLeader[]; redemptions: QuestRedemption[];
  orgScore: number; airLabel: string; actions: Actions;
};

// ================= 3D world layout =================
type Station3D = { type: StationType; name: string; tagline: string; x: number };
const S3D: Station3D[] = [
  { type: "HOME", name: "My Eco Home", tagline: "Your stats, badges & level", x: -16 },
  { type: "VILLAGE_HALL", name: "Village Hall", tagline: "CSR community quests", x: -10.5 },
  { type: "BIKE_DOCK", name: "Bike Dock", tagline: "Green commute quests", x: -5 },
  { type: "SOLAR_FARM", name: "Solar Farm", tagline: "Energy saver quests", x: 0.5 },
  { type: "RECYCLE_HUB", name: "Recycle Hub", tagline: "Zero waste quests", x: 6 },
  { type: "TRADING_POST", name: "Trading Post", tagline: "Claim gift cards & rewards", x: 11.5 },
  { type: "HALL_OF_FAME", name: "Hall of Fame", tagline: "Leaderboard", x: 16.5 },
];
const roadZ = (x: number) => Math.sin(x * 0.3) * 0.9;
const HERO_SPEED = 5.2;

type WorldStore = {
  heroX: number; targetX: number | null; walking: boolean; facing: number;
  pending: Station3D | null; clock: number;
};

// ================= tick engine (timer-driven, throttle-proof) =================
function Ticker({ store, onArrive }: { store: React.MutableRefObject<WorldStore>; onArrive: (s: Station3D) => void }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const s = store.current;
      s.clock += dt;
      if (s.targetX !== null) {
        const dir = Math.sign(s.targetX - s.heroX);
        if (dir === 0 || Math.abs(s.targetX - s.heroX) <= HERO_SPEED * dt) {
          s.heroX = s.targetX;
          s.targetX = null;
          s.walking = false;
          const st = s.pending;
          s.pending = null;
          if (st) onArrive(st);
        } else {
          s.heroX += dir * HERO_SPEED * dt;
          s.facing = dir;
          s.walking = true;
        }
      }
      invalidate();
    }, 16);
    return () => clearInterval(id);
  }, [store, onArrive, invalidate]);
  return null;
}

// ================= hero =================
function Hero3D({ store }: { store: React.MutableRefObject<WorldStore> }) {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Mesh>(null);
  const legR = useRef<THREE.Mesh>(null);
  useFrame(({ camera }) => {
    const s = store.current;
    const z = roadZ(s.heroX);
    if (group.current) {
      group.current.position.set(s.heroX, 0, z);
      const targetRot = s.facing >= 0 ? Math.PI / 2 : -Math.PI / 2;
      group.current.rotation.y += (targetRot - group.current.rotation.y) * 0.2;
    }
    if (body.current) {
      body.current.position.y = s.walking ? Math.abs(Math.sin(s.clock * 10)) * 0.14 : Math.sin(s.clock * 2) * 0.03;
    }
    const swing = s.walking ? Math.sin(s.clock * 10) * 0.6 : 0;
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
    // smooth camera follow
    camera.position.x += (s.heroX - camera.position.x) * 0.06;
    camera.position.y += (5.4 - camera.position.y) * 0.05;
    camera.position.z += (10.5 - camera.position.z) * 0.05;
    camera.lookAt(camera.position.x, 1.1, 0);
  });
  return (
    <group ref={group}>
      <group ref={body}>
        {/* legs */}
        <mesh ref={legL} position={[0.11, 0.42, 0]} castShadow>
          <capsuleGeometry args={[0.09, 0.32, 4, 8]} />
          <meshStandardMaterial color="#3f6212" />
        </mesh>
        <mesh ref={legR} position={[-0.11, 0.42, 0]} castShadow>
          <capsuleGeometry args={[0.09, 0.32, 4, 8]} />
          <meshStandardMaterial color="#365314" />
        </mesh>
        {/* torso */}
        <mesh position={[0, 0.95, 0]} castShadow>
          <capsuleGeometry args={[0.26, 0.45, 8, 16]} />
          <meshStandardMaterial color="#16a34a" />
        </mesh>
        {/* arms */}
        <mesh position={[0.34, 0.95, 0]} rotation={[0, 0, -0.25]} castShadow>
          <capsuleGeometry args={[0.07, 0.36, 4, 8]} />
          <meshStandardMaterial color="#15803d" />
        </mesh>
        <mesh position={[-0.34, 0.95, 0]} rotation={[0, 0, 0.25]} castShadow>
          <capsuleGeometry args={[0.07, 0.36, 4, 8]} />
          <meshStandardMaterial color="#15803d" />
        </mesh>
        {/* head */}
        <mesh position={[0, 1.62, 0]} castShadow>
          <sphereGeometry args={[0.26, 24, 24]} />
          <meshStandardMaterial color="#fcd9b8" />
        </mesh>
        {/* eyes */}
        <mesh position={[0.1, 1.68, 0.22]}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
        <mesh position={[-0.1, 1.68, 0.22]}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
        {/* leaf hat */}
        <mesh position={[0, 1.86, 0]} rotation={[0.15, 0, 0]} castShadow>
          <coneGeometry args={[0.3, 0.28, 16]} />
          <meshStandardMaterial color="#15803d" />
        </mesh>
        <mesh position={[0.16, 2.0, 0]} rotation={[0, 0, -0.7]}>
          <sphereGeometry args={[0.09, 8, 8]} />
          <meshStandardMaterial color="#22c55e" />
        </mesh>
      </group>
      {/* shadow blob */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.42, 24]} />
        <meshBasicMaterial color="#000" transparent opacity={0.22} />
      </mesh>
    </group>
  );
}

// ================= scenery =================
function Windmill({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) {
  const rotor = useRef<THREE.Group>(null);
  const store = useRef(0);
  useFrame((_, __) => {
    if (rotor.current) rotor.current.rotation.z = (store.current += 0.02);
  });
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 2.2, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.16, 4.4, 10]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
      <group ref={rotor} position={[0, 4.4, 0.15]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation={[0, 0, (i * Math.PI * 2) / 3]} position={[0, 0, 0]} castShadow>
            <boxGeometry args={[0.14, 1.9, 0.05]} />
            <meshStandardMaterial color="#f8fafc" />
          </mesh>
        ))}
        <mesh>
          <sphereGeometry args={[0.16, 12, 12]} />
          <meshStandardMaterial color="#64748b" />
        </mesh>
      </group>
    </group>
  );
}

function Tree3D({ x, z, s = 1 }: { x: number; z: number; s?: number }) {
  return (
    <group position={[x, 0, z]} scale={s}>
      <mesh position={[0, 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.13, 0.8, 8]} />
        <meshStandardMaterial color="#92603d" />
      </mesh>
      <mesh position={[0, 1.15, 0]} castShadow>
        <coneGeometry args={[0.6, 1.2, 10]} />
        <meshStandardMaterial color="#16a34a" />
      </mesh>
      <mesh position={[0, 1.7, 0]} castShadow>
        <coneGeometry args={[0.42, 0.9, 10]} />
        <meshStandardMaterial color="#22c55e" />
      </mesh>
    </group>
  );
}

function Cloud3D({ offset, speed, y, z }: { offset: number; speed: number; y: number; z: number }) {
  const g = useRef<THREE.Group>(null);
  const t = useRef(offset);
  useFrame(() => {
    t.current += speed;
    if (g.current) g.current.position.x = ((t.current % 70) + 70) % 70 - 35;
  });
  return (
    <group ref={g} position={[0, y, z]}>
      {[[-0.9, 0, 0.62], [0, 0.25, 0.8], [0.9, 0, 0.55]].map(([dx, dy, r], i) => (
        <mesh key={i} position={[dx as number, dy as number, 0]}>
          <sphereGeometry args={[r as number, 12, 12]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.92} />
        </mesh>
      ))}
    </group>
  );
}

// ================= station buildings =================
function Building({ type }: { type: StationType }) {
  switch (type) {
    case "HOME":
      return (
        <group>
          <mesh position={[0, 0.7, 0]} castShadow>
            <boxGeometry args={[1.8, 1.4, 1.5]} />
            <meshStandardMaterial color="#fde68a" />
          </mesh>
          <mesh position={[0, 1.75, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <coneGeometry args={[1.55, 1.0, 4]} />
            <meshStandardMaterial color="#16a34a" />
          </mesh>
          <mesh position={[0, 0.45, 0.78]}>
            <boxGeometry args={[0.45, 0.9, 0.06]} />
            <meshStandardMaterial color="#92603d" />
          </mesh>
        </group>
      );
    case "VILLAGE_HALL":
      return (
        <group>
          <mesh position={[0, 0.9, 0]} castShadow>
            <boxGeometry args={[2.8, 1.8, 1.8]} />
            <meshStandardMaterial color="#bfdbfe" />
          </mesh>
          <mesh position={[0, 2.25, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <coneGeometry args={[2.3, 1.1, 4]} />
            <meshStandardMaterial color="#3b82f6" />
          </mesh>
          {[-1, 1].map((sx) => (
            <mesh key={sx} position={[sx, 0.7, 0.95]} castShadow>
              <cylinderGeometry args={[0.09, 0.09, 1.4, 8]} />
              <meshStandardMaterial color="#eff6ff" />
            </mesh>
          ))}
          <mesh position={[0, 0.55, 0.92]}>
            <boxGeometry args={[0.6, 1.1, 0.06]} />
            <meshStandardMaterial color="#1e40af" />
          </mesh>
        </group>
      );
    case "BIKE_DOCK":
      return (
        <group>
          <mesh position={[0, 0.08, 0]} receiveShadow>
            <boxGeometry args={[2.6, 0.16, 1.6]} />
            <meshStandardMaterial color="#a3e635" />
          </mesh>
          {[-0.8, 0, 0.8].map((sx) => (
            <group key={sx} position={[sx, 0, 0]}>
              <mesh position={[0, 0.5, 0]} castShadow>
                <torusGeometry args={[0.28, 0.045, 8, 20]} />
                <meshStandardMaterial color="#365314" />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 1.35, -0.6]} castShadow>
            <boxGeometry args={[2.2, 0.5, 0.1]} />
            <meshStandardMaterial color="#365314" />
          </mesh>
        </group>
      );
    case "SOLAR_FARM":
      return (
        <group>
          {[-0.9, 0.5].map((sx) => (
            <group key={sx} position={[sx, 0, 0]}>
              <mesh position={[0, 0.5, 0]} castShadow>
                <cylinderGeometry args={[0.06, 0.06, 1, 8]} />
                <meshStandardMaterial color="#64748b" />
              </mesh>
              <mesh position={[0, 1.0, 0]} rotation={[-0.6, 0, 0]} castShadow>
                <boxGeometry args={[1.2, 0.06, 0.9]} />
                <meshStandardMaterial color="#1e3a8a" metalness={0.6} roughness={0.3} />
              </mesh>
            </group>
          ))}
        </group>
      );
    case "RECYCLE_HUB":
      return (
        <group>
          <mesh position={[0, 0.75, 0]} castShadow>
            <boxGeometry args={[2.2, 1.5, 1.6]} />
            <meshStandardMaterial color="#a7f3d0" />
          </mesh>
          <mesh position={[0, 1.7, 0]} castShadow>
            <sphereGeometry args={[1.0, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#10b981" />
          </mesh>
          <mesh position={[0, 0.55, 0.82]}>
            <boxGeometry args={[0.55, 1.0, 0.06]} />
            <meshStandardMaterial color="#047857" />
          </mesh>
        </group>
      );
    case "TRADING_POST":
      return (
        <group>
          <mesh position={[0, 0.75, 0]} castShadow>
            <boxGeometry args={[2.4, 1.5, 1.6]} />
            <meshStandardMaterial color="#fecaca" />
          </mesh>
          {/* striped awning */}
          {[-0.9, -0.3, 0.3, 0.9].map((sx, i) => (
            <mesh key={sx} position={[sx, 1.62, 0.7]} rotation={[0.5, 0, 0]} castShadow>
              <boxGeometry args={[0.6, 0.06, 0.8]} />
              <meshStandardMaterial color={i % 2 ? "#ef4444" : "#fff1f2"} />
            </mesh>
          ))}
          <mesh position={[0, 0.6, 0.82]}>
            <boxGeometry args={[1.4, 0.7, 0.06]} />
            <meshStandardMaterial color="#7f1d1d" />
          </mesh>
        </group>
      );
    case "HALL_OF_FAME":
      return (
        <group>
          {[[0, 0.35, 1.3], [-1.0, 0.22, 0.9], [1.0, 0.15, 0.7]].map(([dx, h, w], i) => (
            <mesh key={i} position={[dx as number, (h as number) / 2, 0]} castShadow>
              <boxGeometry args={[w as number, h as number, 1]} />
              <meshStandardMaterial color={i === 0 ? "#fbbf24" : i === 1 ? "#d1d5db" : "#d97706"} />
            </mesh>
          ))}
          <mesh position={[0, 0.75, 0]} castShadow>
            <cylinderGeometry args={[0.18, 0.24, 0.5, 12]} />
            <meshStandardMaterial color="#fde047" metalness={0.7} roughness={0.25} />
          </mesh>
          <mesh position={[0, 1.12, 0]} castShadow>
            <sphereGeometry args={[0.22, 12, 12]} />
            <meshStandardMaterial color="#fde047" metalness={0.7} roughness={0.25} />
          </mesh>
        </group>
      );
  }
}

function StationNode({
  s, marker, onWalk,
}: {
  s: Station3D; marker: string | null; onWalk: (s: Station3D) => void;
}) {
  const z = roadZ(s.x) - 2.4;
  return (
    <group
      position={[s.x, 0, z]}
      onClick={(e) => {
        e.stopPropagation();
        onWalk(s);
      }}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "default")}
    >
      <Building type={s.type} />
      <Html center position={[0, 3.1, 0]} distanceFactor={14} zIndexRange={[10, 0]}>
        <div className="pointer-events-none select-none flex flex-col items-center gap-0.5">
          {marker && <div className="text-2xl eco-marker">{marker}</div>}
          <div className="whitespace-nowrap rounded-full bg-slate-900/85 text-white text-[11px] font-bold px-2.5 py-1 border border-white/20 shadow">
            {s.name}
          </div>
        </div>
      </Html>
    </group>
  );
}

// ================= the scene =================
function Scene({
  store, stations, markers, onWalk, onArrive, airScore, isDark,
}: {
  store: React.MutableRefObject<WorldStore>;
  stations: Station3D[];
  markers: Record<string, string | null>;
  onWalk: (s: Station3D) => void;
  onArrive: (s: Station3D) => void;
  airScore: number;
  isDark: boolean;
}) {
  const sky = isDark ? "#0e2a52" : "#8ed1f5";
  const ground = isDark ? "#1a5632" : "#4cc06a";
  const fogFar = 24 + airScore * 0.9; // low ESG score → smoggy village
  const fogColor = isDark ? "#22304a" : "#b9c6c9";

  // road segments along the path
  const segments: { x: number; z: number; rot: number; len: number }[] = [];
  for (let x = -18; x < 18.5; x += 1) {
    const z1 = roadZ(x);
    const z2 = roadZ(x + 1);
    segments.push({
      x: x + 0.5,
      z: (z1 + z2) / 2,
      rot: Math.atan2(z2 - z1, 1),
      len: Math.hypot(1, z2 - z1) + 0.06,
    });
  }

  const trees: [number, number, number][] = [];
  for (let i = 0; i < 26; i++) {
    const x = -19 + i * 1.55 + ((i * 37) % 7) * 0.22;
    const behind = i % 2 === 0;
    const z = behind ? -5.5 - ((i * 13) % 5) * 0.7 : 3.2 + ((i * 29) % 4) * 0.8;
    trees.push([x, z, 0.7 + ((i * 17) % 6) * 0.12]);
  }

  return (
    <>
      <color attach="background" args={[sky]} />
      <fog attach="fog" args={[fogColor, 12, fogFar]} />
      <hemisphereLight intensity={isDark ? 0.5 : 0.9} color={sky} groundColor={ground} />
      <directionalLight
        position={[8, 14, 6]}
        intensity={isDark ? 0.7 : 1.4}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
      />
      {/* sun / moon */}
      <mesh position={[14, 11, -14]}>
        <sphereGeometry args={[1.6, 20, 20]} />
        <meshBasicMaterial color={isDark ? "#e2e8f0" : "#fde047"} />
      </mesh>

      <Ticker store={store} onArrive={onArrive} />

      {/* ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[110, 60]} />
        <meshStandardMaterial color={ground} />
      </mesh>
      {/* distant hills */}
      {[[-20, -14, 7], [-2, -16, 9], [17, -13, 6.5]].map(([x, z, r], i) => (
        <mesh key={i} position={[x, -r * 0.62, z]}>
          <sphereGeometry args={[r, 20, 16]} />
          <meshStandardMaterial color={isDark ? "#153f26" : "#3da65b"} />
        </mesh>
      ))}

      {/* road */}
      {segments.map((seg, i) => (
        <mesh key={i} position={[seg.x, 0.015, seg.z]} rotation={[-Math.PI / 2, 0, -seg.rot]} receiveShadow>
          <planeGeometry args={[seg.len, 1.7]} />
          <meshStandardMaterial color={isDark ? "#8a7250" : "#d6b98c"} />
        </mesh>
      ))}

      {/* scenery */}
      {trees.map(([x, z, s], i) => (
        <Tree3D key={i} x={x} z={z} s={s} />
      ))}
      <Windmill x={-13} z={-7.5} />
      <Windmill x={3} z={-8.5} scale={1.2} />
      <Windmill x={14.5} z={-7} scale={0.9} />
      <Cloud3D offset={0} speed={0.012} y={9} z={-10} />
      <Cloud3D offset={30} speed={0.008} y={10.5} z={-13} />
      <Cloud3D offset={55} speed={0.015} y={8} z={-7} />

      {/* stations */}
      {stations.map((s) => (
        <StationNode key={s.type} s={s} marker={markers[s.type] ?? null} onWalk={onWalk} />
      ))}

      <Hero3D store={store} />
    </>
  );
}

// ================= UI primitives (game styled) =================
function GameButton({
  children, tone = "green", disabled, title,
}: {
  children: React.ReactNode; tone?: "green" | "amber" | "sky"; disabled?: boolean; title?: string;
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

function QuestChip({ label, tone }: { label: string; tone: "green" | "amber" | "red" | "gray" | "violet" }) {
  const tones = {
    green: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
    amber: "bg-amber-500/20 text-amber-300 border-amber-500/50",
    red: "bg-rose-500/20 text-rose-300 border-rose-500/50",
    gray: "bg-slate-500/20 text-slate-300 border-slate-500/50",
    violet: "bg-violet-500/20 text-violet-300 border-violet-500/50",
  };
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${tones[tone]}`}>
      {label}
    </span>
  );
}
const statusTone = (s: string) => (s === "APPROVED" ? "green" : s === "REJECTED" ? "red" : "amber");
const rewardTypeMeta: Record<string, { icon: string; label: string }> = {
  GIFT_CARD: { icon: "🎁", label: "Gift card" },
  PERK: { icon: "🏖️", label: "Perk" },
  MERCH: { icon: "🎒", label: "Merch" },
  DONATION: { icon: "🌱", label: "Donation" },
};

function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 border border-emerald-500/50 px-2.5 py-1 font-mono text-xs text-emerald-300 hover:bg-slate-800 cursor-pointer"
      title="Copy claim code"
    >
      {code}
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
    </button>
  );
}

// ================= tutorial =================
const TUTORIAL_KEY = "ecoquest-tutorial-v1";
const TUTORIAL_STEPS = [
  {
    icon: "🌍",
    title: "Welcome to EcoQuest World!",
    body: "This is your company's living eco-village in 3D. Everything here is real — quests are actual sustainability challenges, and coins are real reward points.",
  },
  {
    icon: "🚶",
    title: "Walk with a click",
    body: "Click any building and your hero walks over. When you arrive, the building's quest board opens automatically.",
  },
  {
    icon: "❗",
    title: "Read the signs",
    body: "❗ = new quests to accept · ⏳ = submitted, awaiting manager approval · ✅ = completed · 🪙 = you can afford something at the Trading Post.",
  },
  {
    icon: "⚡",
    title: "Earn XP, level up",
    body: "Completing quests and CSR events earns XP (levels + badges) and coins. The bar at the top-left is your level progress — badges unlock automatically.",
  },
  {
    icon: "🎁",
    title: "Claim real rewards",
    body: "Spend coins at the Trading Post: gift cards give you an instant claim code (Amazon, Starbucks…). The air of the village mirrors your real ESG score — quest well and the smog lifts!",
  },
];

function Tutorial({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const s = TUTORIAL_STEPS[step];
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4">
      <div className="eco-dialog max-w-md w-full rounded-2xl border-4 border-emerald-600/70 bg-slate-900/95 text-white shadow-2xl p-6">
        <div className="text-4xl mb-3">{s.icon}</div>
        <div className="font-black text-lg mb-1">{s.title}</div>
        <p className="text-sm text-slate-300 leading-relaxed">{s.body}</p>
        <div className="flex items-center justify-between mt-5">
          <div className="flex gap-1.5">
            {TUTORIAL_STEPS.map((_, i) => (
              <span key={i} className={`h-1.5 w-6 rounded-full ${i <= step ? "bg-emerald-500" : "bg-slate-700"}`} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onDone} className="text-xs text-slate-400 hover:text-white cursor-pointer px-2">
              Skip
            </button>
            {step > 0 && (
              <button onClick={() => setStep(step - 1)} className="text-xs text-slate-300 hover:text-white cursor-pointer px-2">
                Back
              </button>
            )}
            <GameButton tone="green">
              <span
                onClick={() => (step === TUTORIAL_STEPS.length - 1 ? onDone() : setStep(step + 1))}
              >
                {step === TUTORIAL_STEPS.length - 1 ? "Start exploring!" : "Next"}
              </span>
            </GameButton>
          </div>
        </div>
      </div>
    </div>
  );
}

// ================= main component =================
export default function QuestWorld3D({
  hero, challenges, activities, rewards, leaders, redemptions, orgScore, airLabel, actions,
}: Props) {
  const store = useRef<WorldStore>({
    heroX: S3D[0].x, targetX: null, walking: false, facing: 1, pending: null, clock: 0,
  });
  const [mounted, setMounted] = useState(false);
  const [openStation, setOpenStation] = useState<Station3D | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [levelUp, setLevelUp] = useState(false);
  const prevLevel = useRef(levelFromXp(hero.xp));

  const level = levelFromXp(hero.xp);
  const progress = levelProgress(hero.xp);

  useEffect(() => {
    setMounted(true);
    setIsDark(document.documentElement.classList.contains("dark"));
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains("dark"))
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    try {
      if (!localStorage.getItem(TUTORIAL_KEY)) setShowTutorial(true);
    } catch {}
    return () => obs.disconnect();
  }, []);

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
  const markers: Record<string, string | null> = {};
  for (const s of S3D) {
    let m: string | null = null;
    if (s.type === "VILLAGE_HALL" && activities.some((a) => !a.mine && a.status === "UPCOMING")) m = "❗";
    if (["BIKE_DOCK", "SOLAR_FARM", "RECYCLE_HUB", "VILLAGE_HALL"].includes(s.type)) {
      const list = byStation(s.type);
      if (!m && list.some((c) => !c.mine)) m = "❗";
      if (!m && list.some((c) => c.mine && c.mine.approvalStatus === "PENDING")) m = "⏳";
      if (!m && list.length && list.every((c) => c.mine?.approvalStatus === "APPROVED")) m = "✅";
    }
    if (s.type === "TRADING_POST" && rewards.some((r) => r.stock > 0 && hero.points >= r.pointsRequired)) m = "🪙";
    markers[s.type] = m;
  }

  const walkTo = useCallback((s: Station3D) => {
    setOpenStation(null);
    const st = store.current;
    if (Math.abs(st.heroX - s.x) < 0.6) {
      setOpenStation(s);
      return;
    }
    st.targetX = s.x;
    st.pending = s;
  }, []);

  const onArrive = useCallback((s: Station3D) => setOpenStation(s), []);
  const dismissTutorial = useCallback(() => {
    setShowTutorial(false);
    try {
      localStorage.setItem(TUTORIAL_KEY, "done");
    } catch {}
  }, []);

  return (
    <div className="relative rounded-2xl overflow-hidden border-4 border-emerald-900/40 shadow-2xl select-none" style={{ height: "min(72vh, 700px)" }}>
      {/* ======= 3D canvas ======= */}
      {mounted && (
        <Canvas
          frameloop="demand"
          shadows
          dpr={[1, 1.75]}
          camera={{ position: [S3D[0].x, 5.4, 10.5], fov: 48 }}
          className="!absolute inset-0"
        >
          <Scene
            store={store}
            stations={S3D}
            markers={markers}
            onWalk={walkTo}
            onArrive={onArrive}
            airScore={orgScore}
            isDark={isDark}
          />
        </Canvas>
      )}

      {/* ======= HUD ======= */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-3 rounded-2xl bg-slate-900/80 backdrop-blur px-4 py-2.5 text-white shadow-lg">
        <div className="h-11 w-11 rounded-full bg-gradient-to-b from-emerald-400 to-green-600 flex items-center justify-center text-xl border-2 border-emerald-200">
          🧑‍🌾
        </div>
        <div className="min-w-44">
          <div className="flex items-center gap-2 text-sm font-bold">
            {hero.name.split(" ")[0]}
            <span className="rounded-full bg-violet-500/90 px-2 py-0.5 text-[10px] uppercase tracking-wide">Lv {level}</span>
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
          <span className="text-[10px] text-slate-400 uppercase">coins</span>
        </div>
        <div
          className="rounded-2xl bg-slate-900/80 backdrop-blur px-3 py-2 text-lg shadow-lg"
          title={hero.badges.map((b) => b.name).join(", ") || "No badges yet"}
        >
          {hero.badges.length ? hero.badges.map((b) => b.icon).join(" ") : "🔒"}
        </div>
        <button
          onClick={() => setShowTutorial(true)}
          className="h-10 w-10 rounded-2xl bg-slate-900/80 backdrop-blur text-white flex items-center justify-center shadow-lg hover:bg-slate-800 cursor-pointer"
          title="How to play"
        >
          <HelpCircle size={17} />
        </button>
      </div>

      <div className="absolute bottom-3 left-3 z-20 rounded-xl bg-slate-900/75 backdrop-blur px-3 py-1.5 text-[11px] text-white shadow-lg flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${orgScore >= 70 ? "bg-emerald-400" : orgScore >= 40 ? "bg-amber-400" : "bg-rose-400"}`} />
        Village air: <b>{orgScore}/100</b>
        <span className="text-slate-400">— live {airLabel} score (smog clears as it rises)</span>
      </div>

      {levelUp && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div className="eco-levelup text-5xl font-black text-amber-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
            ⭐ LEVEL UP! ⭐
          </div>
        </div>
      )}

      {/* ======= quest dialog ======= */}
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
            <div className="max-h-[40vh] overflow-y-auto px-5 py-4 space-y-4">
              <StationContent
                station={openStation}
                hero={hero}
                challenges={byStation(openStation.type)}
                activities={activities}
                rewards={rewards}
                leaders={leaders}
                redemptions={redemptions}
                actions={actions}
              />
            </div>
          </div>
        </div>
      )}

      {showTutorial && <Tutorial onDone={dismissTutorial} />}
    </div>
  );
}

// ================= per-station dialog content =================
function StationContent({
  station, hero, challenges, activities, rewards, leaders, redemptions, actions,
}: {
  station: Station3D; hero: QuestHero; challenges: QuestChallenge[]; activities: QuestActivity[];
  rewards: QuestReward[]; leaders: QuestLeader[]; redemptions: QuestRedemption[]; actions: Actions;
}) {
  if (station.type === "HOME") {
    const level = levelFromXp(hero.xp);
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-300">
          Welcome home, <b>{hero.name.split(" ")[0]}</b>! You are a <b>Level {level} Eco Hero</b> with{" "}
          <b className="text-violet-300">{hero.xp} XP</b> and <b className="text-amber-300">{hero.points} coins</b>.
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
        {redemptions.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400 mb-1.5">My claims</div>
            <div className="space-y-1.5">
              {redemptions.slice(0, 4).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 text-xs bg-slate-800/70 rounded-lg px-3 py-2">
                  <span>
                    {rewardTypeMeta[r.type]?.icon ?? "🎁"} {r.rewardName}
                  </span>
                  {r.voucherCode ? <CopyCode code={r.voucherCode} /> : <QuestChip label="Fulfilled" tone="green" />}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (station.type === "TRADING_POST") {
    return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          {rewards.map((r) => {
            const can = hero.points >= r.pointsRequired && r.stock > 0;
            const meta = rewardTypeMeta[r.type] ?? rewardTypeMeta.MERCH;
            return (
              <div key={r.id} className="rounded-xl bg-slate-800/80 border border-slate-700 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-bold text-sm">
                    {meta.icon} {r.name}
                  </div>
                  <QuestChip label={meta.label} tone={r.type === "GIFT_CARD" ? "violet" : "gray"} />
                </div>
                <div className="text-xs text-slate-400 mb-2">{r.description}</div>
                <div className="flex items-center justify-between">
                  <span className="text-amber-300 font-bold text-sm">🪙 {r.pointsRequired}</span>
                  <span className="text-[10px] text-slate-500">{r.stock > 0 ? `${r.stock} left` : "sold out"}</span>
                </div>
                <form action={actions.redeemReward} className="mt-2">
                  <input type="hidden" name="rewardId" value={r.id} />
                  <GameButton tone="amber" disabled={!can} title={!can ? "Not enough coins or out of stock" : undefined}>
                    {r.stock <= 0 ? "Sold out" : can ? (r.type === "GIFT_CARD" ? "Buy & get code" : "Buy") : "Need more 🪙"}
                  </GameButton>
                </form>
              </div>
            );
          })}
        </div>
        {redemptions.some((r) => r.voucherCode) && (
          <div>
            <div className="text-xs uppercase tracking-wide text-emerald-400 font-bold mb-2">
              🎫 Your claim codes
            </div>
            <div className="space-y-1.5">
              {redemptions
                .filter((r) => r.voucherCode)
                .map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 text-xs bg-slate-800/70 rounded-lg px-3 py-2">
                    <span>
                      {r.rewardName}
                      <span className="text-slate-500 ml-2">{new Date(r.redeemedAt).toLocaleDateString()}</span>
                    </span>
                    <CopyCode code={r.voucherCode!} />
                  </div>
                ))}
            </div>
          </div>
        )}
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

  return <ChallengeList challenges={challenges} actions={actions} emptyText="No quests here yet — check back soon!" />;
}

function ChallengeList({
  challenges, actions, emptyText,
}: {
  challenges: QuestChallenge[]; actions: Actions; emptyText: string;
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
                <QuestChip label={c.difficulty} tone={c.difficulty === "EASY" ? "green" : c.difficulty === "HARD" ? "red" : "amber"} />
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
