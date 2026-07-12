"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { StationType, levelFromXp, levelProgress, xpToNext } from "@/lib/game";
import ProofUpload from "@/components/ProofUpload";
import { X, Zap, MapPin, HelpCircle, Copy, Check, Video, UserRound } from "lucide-react";

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

// ================= world layout: compact village circle =================
type Station3D = { type: StationType; name: string; tagline: string; x: number; z: number; angle: number };

const RING_R = 10.5;
const STATION_META: { type: StationType; name: string; tagline: string }[] = [
  { type: "HOME", name: "My Eco Home", tagline: "Your stats, badges & level" },
  { type: "VILLAGE_HALL", name: "Village Hall", tagline: "CSR community quests" },
  { type: "BIKE_DOCK", name: "Bike Dock", tagline: "Green commute quests" },
  { type: "SOLAR_FARM", name: "Solar Farm", tagline: "Energy saver quests" },
  { type: "RECYCLE_HUB", name: "Recycle Hub", tagline: "Zero waste quests" },
  { type: "TRADING_POST", name: "Trading Post", tagline: "Claim gift cards & rewards" },
  { type: "HALL_OF_FAME", name: "Hall of Fame", tagline: "Leaderboard" },
];
const S3D: Station3D[] = STATION_META.map((m, i) => {
  const angle = (i / STATION_META.length) * Math.PI * 2 + Math.PI; // HOME in front of spawn
  return { ...m, angle, x: Math.sin(angle) * RING_R, z: Math.cos(angle) * RING_R };
});

const WALK_SPEED = 4.4;
const RUN_SPEED = 7.4;
const TURN_SPEED = 2.7; // rad/s
const JUMP_V = 5.4;
const GRAVITY = 14.5;
const INTERACT_DIST = 3.6;
const WORLD_R = 20; // roam bounds

type AvatarKind = "BOY" | "GIRL";

type WorldStore = {
  x: number; z: number; y: number; yaw: number; vy: number;
  grounded: boolean; moving: boolean; running: boolean;
  clock: number; gait: number; // gait phase for limb swing
  keys: Set<string>;
  paused: boolean;
  fpv: boolean;
};

// ================= physics + input step (called from the main component's loop) =================
function stepWorld(s: WorldStore, dt: number) {
  s.clock += dt;
  if (s.paused) {
    s.moving = false;
    return;
  }
  const k = s.keys;
  const fwd = k.has("ArrowUp") || k.has("KeyW") ? 1 : k.has("ArrowDown") || k.has("KeyS") ? -0.62 : 0;
  const turn = (k.has("ArrowLeft") || k.has("KeyA") ? 1 : 0) - (k.has("ArrowRight") || k.has("KeyD") ? 1 : 0);
  s.running = k.has("ShiftLeft") || k.has("ShiftRight");

  s.yaw += turn * TURN_SPEED * dt;

  const speed = (s.running ? RUN_SPEED : WALK_SPEED) * fwd;
  s.moving = fwd !== 0;
  if (s.moving) {
    s.gait += dt * (s.running ? 13 : 9);
    const nx = s.x + Math.sin(s.yaw) * speed * dt;
    const nz = s.z + Math.cos(s.yaw) * speed * dt;
    const r = Math.hypot(nx, nz);
    let px = r > WORLD_R ? (nx / r) * WORLD_R : nx;
    let pz = r > WORLD_R ? (nz / r) * WORLD_R : nz;
    for (const st of S3D) {
      const dx = px - st.x;
      const dz = pz - st.z;
      const d = Math.hypot(dx, dz);
      if (d < 2.1 && d > 0.001) {
        px = st.x + (dx / d) * 2.1;
        pz = st.z + (dz / d) * 2.1;
      }
    }
    s.x = px;
    s.z = pz;
  } else {
    s.gait *= 0.9;
  }

  if (k.has("Space") && s.grounded) {
    s.vy = JUMP_V;
    s.grounded = false;
  }
  if (!s.grounded) {
    s.y += s.vy * dt;
    s.vy -= GRAVITY * dt;
    if (s.y <= 0) {
      s.y = 0;
      s.vy = 0;
      s.grounded = true;
    }
  }
}

/** Nearest station within interact distance (for the E prompt). */
function nearestStation(s: WorldStore): Station3D | null {
  let near: Station3D | null = null;
  let best = INTERACT_DIST;
  for (const st of S3D) {
    const d = Math.hypot(s.x - st.x, s.z - st.z);
    if (d < best) {
      best = d;
      near = st;
    }
  }
  return near;
}

// ================= full-bodied avatar (boy / girl) =================
function AvatarBody({
  store, kind, visible,
}: {
  store: React.MutableRefObject<WorldStore>; kind: AvatarKind; visible: boolean;
}) {
  const root = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);

  const skin = "#fcd9b8";
  const shirt = kind === "GIRL" ? "#0d9488" : "#16a34a";
  const shirtLight = kind === "GIRL" ? "#14b8a6" : "#22c55e";
  const pants = kind === "GIRL" ? "#7c3aed" : "#365314";
  const hair = kind === "GIRL" ? "#7c2d12" : "#1f2937";

  useFrame(() => {
    const s = store.current;
    if (!root.current) return;
    root.current.visible = visible;
    root.current.position.set(s.x, s.y, s.z);
    root.current.rotation.y = s.yaw;
    const swing = s.moving ? Math.sin(s.gait) * (s.running ? 0.95 : 0.65) : 0;
    const idle = s.moving ? 0 : Math.sin(s.clock * 2) * 0.04;
    if (armL.current) armL.current.rotation.x = swing;
    if (armR.current) armR.current.rotation.x = -swing;
    if (legL.current) legL.current.rotation.x = -swing;
    if (legR.current) legR.current.rotation.x = swing;
    if (body.current) body.current.position.y = (s.moving && s.grounded ? Math.abs(Math.sin(s.gait)) * 0.06 : idle);
    // airborne pose
    if (!s.grounded) {
      if (legL.current) legL.current.rotation.x = -0.5;
      if (legR.current) legR.current.rotation.x = 0.35;
      if (armL.current) armL.current.rotation.x = -2.4;
      if (armR.current) armR.current.rotation.x = -2.4;
    }
  });

  return (
    <group ref={root}>
      <group ref={body}>
        {/* legs (pivot at hips) */}
        <group ref={legL} position={[0.12, 0.86, 0]}>
          <mesh position={[0, -0.28, 0]} castShadow>
            <capsuleGeometry args={[0.095, 0.4, 4, 8]} />
            <meshStandardMaterial color={pants} />
          </mesh>
          {/* foot */}
          <mesh position={[0, -0.56, 0.07]} castShadow>
            <boxGeometry args={[0.16, 0.1, 0.3]} />
            <meshStandardMaterial color="#78350f" />
          </mesh>
        </group>
        <group ref={legR} position={[-0.12, 0.86, 0]}>
          <mesh position={[0, -0.28, 0]} castShadow>
            <capsuleGeometry args={[0.095, 0.4, 4, 8]} />
            <meshStandardMaterial color={pants} />
          </mesh>
          <mesh position={[0, -0.56, 0.07]} castShadow>
            <boxGeometry args={[0.16, 0.1, 0.3]} />
            <meshStandardMaterial color="#78350f" />
          </mesh>
        </group>
        {/* torso */}
        <mesh position={[0, 1.18, 0]} castShadow>
          <capsuleGeometry args={[0.27, 0.42, 8, 16]} />
          <meshStandardMaterial color={shirt} />
        </mesh>
        <mesh position={[0, 1.34, 0]} castShadow>
          <capsuleGeometry args={[0.275, 0.16, 8, 16]} />
          <meshStandardMaterial color={shirtLight} />
        </mesh>
        {kind === "GIRL" && (
          // skirt
          <mesh position={[0, 0.92, 0]} castShadow>
            <coneGeometry args={[0.34, 0.34, 14]} />
            <meshStandardMaterial color={pants} />
          </mesh>
        )}
        {/* arms (pivot at shoulders) */}
        <group ref={armL} position={[0.34, 1.42, 0]}>
          <mesh position={[0, -0.24, 0]} castShadow>
            <capsuleGeometry args={[0.075, 0.36, 4, 8]} />
            <meshStandardMaterial color={shirt} />
          </mesh>
          {/* hand */}
          <mesh position={[0, -0.48, 0]} castShadow>
            <sphereGeometry args={[0.085, 10, 10]} />
            <meshStandardMaterial color={skin} />
          </mesh>
        </group>
        <group ref={armR} position={[-0.34, 1.42, 0]}>
          <mesh position={[0, -0.24, 0]} castShadow>
            <capsuleGeometry args={[0.075, 0.36, 4, 8]} />
            <meshStandardMaterial color={shirt} />
          </mesh>
          <mesh position={[0, -0.48, 0]} castShadow>
            <sphereGeometry args={[0.085, 10, 10]} />
            <meshStandardMaterial color={skin} />
          </mesh>
        </group>
        {/* head */}
        <mesh position={[0, 1.78, 0]} castShadow>
          <sphereGeometry args={[0.24, 24, 24]} />
          <meshStandardMaterial color={skin} />
        </mesh>
        {/* eyes */}
        <mesh position={[0.09, 1.82, 0.2]}>
          <sphereGeometry args={[0.032, 8, 8]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
        <mesh position={[-0.09, 1.82, 0.2]}>
          <sphereGeometry args={[0.032, 8, 8]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
        {/* hair */}
        {kind === "BOY" ? (
          <mesh position={[0, 1.92, -0.02]} castShadow>
            <sphereGeometry args={[0.235, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2.4]} />
            <meshStandardMaterial color={hair} />
          </mesh>
        ) : (
          <group>
            <mesh position={[0, 1.9, -0.03]} castShadow>
              <sphereGeometry args={[0.245, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color={hair} />
            </mesh>
            {/* ponytail */}
            <mesh position={[0, 1.78, -0.26]} rotation={[0.5, 0, 0]} castShadow>
              <capsuleGeometry args={[0.07, 0.34, 4, 8]} />
              <meshStandardMaterial color={hair} />
            </mesh>
          </group>
        )}
        {/* leaf badge */}
        <mesh position={[0.16, 1.4, 0.24]} rotation={[0, 0, -0.5]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial color="#a3e635" />
        </mesh>
      </group>
      {/* soft shadow blob */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.4, 20]} />
        <meshBasicMaterial color="#000" transparent opacity={0.2} />
      </mesh>
    </group>
  );
}

// FPV arms — swing in view while walking, like a real first-person game
function FpvArms({ store, kind }: { store: React.MutableRefObject<WorldStore>; kind: AvatarKind }) {
  const group = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const shirt = kind === "GIRL" ? "#0d9488" : "#16a34a";
  const skin = "#fcd9b8";
  useFrame(({ camera }) => {
    const s = store.current;
    if (!group.current) return;
    group.current.visible = s.fpv;
    group.current.position.copy(camera.position);
    group.current.quaternion.copy(camera.quaternion);
    const swing = s.moving ? Math.sin(s.gait) * (s.running ? 0.5 : 0.32) : Math.sin(s.clock * 1.6) * 0.03;
    if (armL.current) armL.current.position.z = -0.55 + Math.sin(s.gait) * (s.moving ? 0.12 : 0);
    if (armR.current) armR.current.position.z = -0.55 - Math.sin(s.gait) * (s.moving ? 0.12 : 0);
    if (armL.current) armL.current.rotation.x = -0.4 + swing * 0.4;
    if (armR.current) armR.current.rotation.x = -0.4 - swing * 0.4;
  });
  return (
    <group ref={group}>
      <group ref={armL} position={[0.32, -0.42, -0.55]} rotation={[-0.4, 0.15, 0]}>
        <mesh castShadow={false}>
          <capsuleGeometry args={[0.075, 0.42, 4, 8]} />
          <meshStandardMaterial color={shirt} />
        </mesh>
        <mesh position={[0, 0.28, 0]}>
          <sphereGeometry args={[0.09, 10, 10]} />
          <meshStandardMaterial color={skin} />
        </mesh>
      </group>
      <group ref={armR} position={[-0.32, -0.42, -0.55]} rotation={[-0.4, -0.15, 0]}>
        <mesh>
          <capsuleGeometry args={[0.075, 0.42, 4, 8]} />
          <meshStandardMaterial color={shirt} />
        </mesh>
        <mesh position={[0, 0.28, 0]}>
          <sphereGeometry args={[0.09, 10, 10]} />
          <meshStandardMaterial color={skin} />
        </mesh>
      </group>
    </group>
  );
}

// camera rig: FPV head-cam with bob, or third-person follow
function CameraRig({ store }: { store: React.MutableRefObject<WorldStore> }) {
  useFrame(({ camera }) => {
    const s = store.current;
    const fx = Math.sin(s.yaw);
    const fz = Math.cos(s.yaw);
    if (s.fpv) {
      const bob = s.moving && s.grounded ? Math.abs(Math.sin(s.gait)) * 0.07 : 0;
      const eye = new THREE.Vector3(s.x, s.y + 1.62 + bob, s.z);
      camera.position.lerp(eye, 0.55);
      camera.lookAt(eye.x + fx, eye.y - 0.06, eye.z + fz);
    } else {
      const target = new THREE.Vector3(s.x - fx * 5.2, s.y + 2.7, s.z - fz * 5.2);
      camera.position.lerp(target, 0.09);
      camera.lookAt(s.x, s.y + 1.35, s.z);
    }
  });
  return null;
}

// ================= scenery =================
function Windmill({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) {
  const rotor = useRef<THREE.Group>(null);
  const t = useRef(0);
  useFrame(() => {
    if (rotor.current) rotor.current.rotation.z = (t.current += 0.02);
  });
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 2.2, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.16, 4.4, 10]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
      <group ref={rotor} position={[0, 4.4, 0.15]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation={[0, 0, (i * Math.PI * 2) / 3]} castShadow>
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

// ================= station buildings (face the plaza) =================
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
            <mesh key={sx} position={[sx, 0.5, 0]} castShadow>
              <torusGeometry args={[0.28, 0.045, 8, 20]} />
              <meshStandardMaterial color="#365314" />
            </mesh>
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
  s, marker, near,
}: {
  s: Station3D; marker: string | null; near: boolean;
}) {
  // building faces the central plaza
  const faceCenter = Math.atan2(-s.x, -s.z);
  return (
    <group position={[s.x, 0, s.z]} rotation={[0, faceCenter, 0]}>
      <Building type={s.type} />
      <Html center position={[0, 3.2, 0]} distanceFactor={13} zIndexRange={[10, 0]}>
        <div className="pointer-events-none select-none flex flex-col items-center gap-0.5">
          {marker && <div className="text-2xl eco-marker">{marker}</div>}
          <div
            className={`whitespace-nowrap rounded-full text-[11px] font-bold px-2.5 py-1 border shadow ${
              near
                ? "bg-emerald-500 text-white border-emerald-200 scale-110"
                : "bg-slate-900/85 text-white border-white/20"
            }`}
          >
            {s.name}
          </div>
        </div>
      </Html>
    </group>
  );
}

// ================= scene =================
function Scene({
  store, markers, nearType, airScore, isDark, avatar,
}: {
  store: React.MutableRefObject<WorldStore>;
  markers: Record<string, string | null>;
  nearType: StationType | null;
  airScore: number;
  isDark: boolean;
  avatar: AvatarKind;
}) {
  const sky = isDark ? "#0e2a52" : "#8ed1f5";
  const ground = isDark ? "#1a5632" : "#4cc06a";
  const fogFar = 26 + airScore * 0.9;
  const fogColor = isDark ? "#22304a" : "#b9c6c9";

  const trees: [number, number, number][] = [];
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + 0.21;
    const r = 15.5 + ((i * 13) % 5);
    trees.push([Math.sin(a) * r, Math.cos(a) * r, 0.75 + ((i * 17) % 5) * 0.13]);
  }

  return (
    <>
      <color attach="background" args={[sky]} />
      <fog attach="fog" args={[fogColor, 14, fogFar]} />
      <hemisphereLight intensity={isDark ? 0.5 : 0.9} color={sky} groundColor={ground} />
      <directionalLight
        position={[10, 16, 8]}
        intensity={isDark ? 0.7 : 1.4}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={26}
        shadow-camera-bottom={-26}
      />
      <mesh position={[16, 13, -18]}>
        <sphereGeometry args={[1.6, 20, 20]} />
        <meshBasicMaterial color={isDark ? "#e2e8f0" : "#fde047"} />
      </mesh>

      <CameraRig store={store} />

      {/* ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[46, 48]} />
        <meshStandardMaterial color={ground} />
      </mesh>
      {/* ring road + plaza */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} receiveShadow>
        <ringGeometry args={[RING_R - 1.6, RING_R + 1.6, 64]} />
        <meshStandardMaterial color={isDark ? "#8a7250" : "#d6b98c"} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} receiveShadow>
        <circleGeometry args={[3.4, 32]} />
        <meshStandardMaterial color={isDark ? "#8a7250" : "#d6b98c"} />
      </mesh>
      {/* spokes from plaza to each station */}
      {S3D.map((s) => {
        const midX = s.x * 0.55;
        const midZ = s.z * 0.55;
        const len = RING_R - 3.2;
        const rot = Math.atan2(s.x, s.z);
        return (
          <mesh key={s.type} rotation={[-Math.PI / 2, 0, -rot]} position={[midX, 0.012, midZ]} receiveShadow>
            <planeGeometry args={[1.1, len]} />
            <meshStandardMaterial color={isDark ? "#8a7250" : "#d6b98c"} />
          </mesh>
        );
      })}
      {/* plaza centerpiece */}
      <group position={[0, 0, 0]}>
        <mesh position={[0, 0.5, 0]} castShadow>
          <cylinderGeometry args={[0.35, 0.45, 1, 12]} />
          <meshStandardMaterial color={isDark ? "#475569" : "#94a3b8"} />
        </mesh>
        <Tree3D x={0} z={0} s={1.45} />
      </group>

      {/* distant hills */}
      {[[-24, -20, 8], [4, -26, 10], [24, -18, 7], [-6, 26, 9], [22, 20, 7]].map(([x, z, r], i) => (
        <mesh key={i} position={[x, -r * 0.62, z]}>
          <sphereGeometry args={[r, 20, 16]} />
          <meshStandardMaterial color={isDark ? "#153f26" : "#3da65b"} />
        </mesh>
      ))}

      {trees.map(([x, z, sc], i) => (
        <Tree3D key={i} x={x} z={z} s={sc} />
      ))}
      <Windmill x={-18} z={-12} />
      <Windmill x={6} z={-19} scale={1.2} />
      <Windmill x={19} z={10} scale={0.9} />
      <Cloud3D offset={0} speed={0.012} y={10} z={-12} />
      <Cloud3D offset={30} speed={0.008} y={12} z={-16} />
      <Cloud3D offset={55} speed={0.015} y={9} z={8} />

      {S3D.map((s) => (
        <StationNode key={s.type} s={s} marker={markers[s.type] ?? null} near={nearType === s.type} />
      ))}

      <AvatarBody store={store} kind={avatar} visible={!store.current.fpv} />
      <FpvArms store={store} kind={avatar} />
    </>
  );
}

// ================= minimap =================
function Minimap({
  store, markers, nearType,
}: {
  store: React.MutableRefObject<WorldStore>;
  markers: Record<string, string | null>;
  nearType: StationType | null;
}) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 140);
    return () => clearInterval(id);
  }, []);
  const s = store.current;
  const SC = 130 / (WORLD_R * 2 + 6); // world → px
  const px = (v: number) => 65 + v * SC;
  const stationDot: Record<string, string> = {
    HOME: "#fde68a", VILLAGE_HALL: "#3b82f6", BIKE_DOCK: "#a3e635", SOLAR_FARM: "#93c5fd",
    RECYCLE_HUB: "#10b981", TRADING_POST: "#ef4444", HALL_OF_FAME: "#fbbf24",
  };
  return (
    <div className="rounded-2xl bg-slate-900/80 backdrop-blur p-2 shadow-lg border border-white/10">
      <svg width="130" height="130" className="block">
        <circle cx="65" cy="65" r="62" fill="#0f172a" stroke="#334155" strokeWidth="2" />
        {/* ring road */}
        <circle cx="65" cy="65" r={RING_R * SC} fill="none" stroke="#8a7250" strokeWidth="4" opacity="0.7" />
        {S3D.map((st) => (
          <g key={st.type}>
            <circle
              cx={px(st.x)}
              cy={px(st.z)}
              r={nearType === st.type ? 6 : 4}
              fill={stationDot[st.type]}
              stroke={nearType === st.type ? "#fff" : "none"}
              strokeWidth="1.5"
            />
            {markers[st.type] === "❗" && (
              <circle cx={px(st.x) + 4} cy={px(st.z) - 4} r="2.4" fill="#f59e0b" />
            )}
          </g>
        ))}
        {/* player arrow */}
        <g transform={`translate(${px(s.x)},${px(s.z)}) rotate(${(s.yaw * 180) / Math.PI})`}>
          <polygon points="0,-7 4.6,4.5 0,2.2 -4.6,4.5" fill="#34d399" stroke="#fff" strokeWidth="1" />
        </g>
      </svg>
      <div className="text-center text-[9px] text-slate-400 uppercase tracking-widest mt-1">Village map</div>
    </div>
  );
}

// ================= UI primitives =================
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
const rewardTypeMeta: Record<string, { icon: string; label: string; fulfillment: string }> = {
  GIFT_CARD: { icon: "🎁", label: "Gift card", fulfillment: "Instant claim code — also emailed to your work inbox" },
  PERK: { icon: "🏖️", label: "Perk", fulfillment: "HR adds it to your account within 2 working days" },
  MERCH: { icon: "🎒", label: "Merch", fulfillment: "Show your confirmation email at company reception to collect" },
  DONATION: { icon: "🌱", label: "Donation", fulfillment: "Certificate emailed to you once processed" },
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

// ================= avatar picker =================
function AvatarPicker({ onPick }: { onPick: (k: AvatarKind) => void }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[3px] p-4">
      <div className="eco-dialog max-w-lg w-full rounded-2xl border-4 border-emerald-600/70 bg-slate-900/95 text-white shadow-2xl p-6 text-center">
        <div className="font-black text-xl mb-1">Choose your Eco Hero</div>
        <p className="text-sm text-slate-400 mb-5">You can switch anytime with the 👤 button</p>
        <div className="grid grid-cols-2 gap-4">
          {(
            [
              { k: "GIRL" as AvatarKind, emoji: "👧", name: "Maya", desc: "Teal explorer · ponytail" },
              { k: "BOY" as AvatarKind, emoji: "👦", name: "Arjun", desc: "Green ranger · leaf cap" },
            ]
          ).map((a) => (
            <button
              key={a.k}
              onClick={() => onPick(a.k)}
              className="group rounded-2xl border-2 border-slate-700 hover:border-emerald-500 bg-slate-800/70 p-5 transition-all hover:scale-[1.03] cursor-pointer"
            >
              <div className="text-6xl mb-3 group-hover:scale-110 transition-transform">{a.emoji}</div>
              <div className="font-bold">{a.name}</div>
              <div className="text-xs text-slate-400">{a.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ================= tutorial =================
const TUTORIAL_KEY = "ecoquest-tutorial-v2";
const TUTORIAL_STEPS = [
  {
    icon: "🌍",
    title: "Welcome to EcoQuest World!",
    body: "Your company's living 3D eco-village. Quests are real sustainability challenges, coins are real reward points — and you're in first person.",
  },
  {
    icon: "🎮",
    title: "Move like a game",
    body: "↑↓ (or W/S) walk forward & back · ←→ (or A/D) turn · hold Shift to run · Space to jump. Press C to switch between first-person and third-person camera.",
  },
  {
    icon: "🗺️",
    title: "Find your way",
    body: "The minimap (top-right) shows all stations around the village circle — the green arrow is you. Orange dots mean new quests are waiting there.",
  },
  {
    icon: "⚡",
    title: "Walk up & interact",
    body: "Get close to any building and press E or Enter to open its quest board. ❗ new quests · ⏳ pending approval · ✅ done · 🪙 shop affordable.",
  },
  {
    icon: "🎁",
    title: "Level up & claim rewards",
    body: "Quests earn XP (levels, badges) and coins. Spend coins at the Trading Post — gift cards give instant claim codes. The village air mirrors your real ESG score!",
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
              <span onClick={() => (step === TUTORIAL_STEPS.length - 1 ? onDone() : setStep(step + 1))}>
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
    x: 0, z: 2.5, y: 0, yaw: Math.PI, vy: 0,
    grounded: true, moving: false, running: false,
    clock: 0, gait: 0, keys: new Set(), paused: false, fpv: true,
  });
  const [mounted, setMounted] = useState(false);
  const [openStation, setOpenStation] = useState<Station3D | null>(null);
  const [nearStation, setNearStation] = useState<Station3D | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [avatar, setAvatar] = useState<AvatarKind | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [fpv, setFpv] = useState(true);
  const [levelUp, setLevelUp] = useState(false);
  const prevLevel = useRef(levelFromXp(hero.xp));
  const openStationRef = useRef<Station3D | null>(null);
  const nearRef = useRef<Station3D | null>(null);
  openStationRef.current = openStation;
  nearRef.current = nearStation;

  const level = levelFromXp(hero.xp);
  const progress = levelProgress(hero.xp);

  // pause movement while a dialog / overlay is open
  useEffect(() => {
    store.current.paused = !!openStation || showTutorial || showPicker || !avatar;
  }, [openStation, showTutorial, showPicker, avatar]);
  useEffect(() => {
    store.current.fpv = fpv;
  }, [fpv]);

  useEffect(() => {
    setMounted(true);
    setIsDark(document.documentElement.classList.contains("dark"));
    const obs = new MutationObserver(() => setIsDark(document.documentElement.classList.contains("dark")));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    try {
      const saved = localStorage.getItem("ecoquest-avatar") as AvatarKind | null;
      if (saved === "BOY" || saved === "GIRL") setAvatar(saved);
      else setShowPicker(true);
      if (!localStorage.getItem(TUTORIAL_KEY)) setShowTutorial(true);
    } catch {
      setAvatar("BOY");
    }
    return () => obs.disconnect();
  }, []);

  // keyboard controls
  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement as HTMLElement | null;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if (isTyping()) return;
      const game = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "KeyW", "KeyA", "KeyS", "KeyD"];
      if (game.includes(e.code)) {
        e.preventDefault();
        store.current.keys.add(e.code);
      }
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") store.current.keys.add(e.code);
      if (e.code === "KeyC") setFpv((v) => !v);
      if ((e.code === "Enter" || e.code === "KeyE") && !openStationRef.current && nearRef.current) {
        e.preventDefault();
        setOpenStation(nearRef.current);
      }
      if (e.code === "Escape") setOpenStation(null);
    };
    const up = (e: KeyboardEvent) => {
      store.current.keys.delete(e.code);
    };
    const blur = () => store.current.keys.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
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

  // ===== physics + input loop (plain React, runs regardless of the canvas render mode) =====
  const lastNear = useRef<StationType | null>(null);
  useEffect(() => {
    let last = Date.now();
    let raf = 0;
    let timer: ReturnType<typeof setInterval> | null = null;
    const tick = () => {
      const now = Date.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      stepWorld(store.current, dt);
      const near = nearestStation(store.current);
      const nt = store.current.paused ? null : near?.type ?? null;
      if (nt !== lastNear.current) {
        lastNear.current = nt;
        setNearStation(nt ? near : null);
      }
    };
    // rAF keeps physics in lockstep with rendering when the tab is active;
    // a 33ms interval backs it up if rAF is throttled (background/embedded tabs).
    const rafLoop = () => {
      tick();
      raf = requestAnimationFrame(rafLoop);
    };
    raf = requestAnimationFrame(rafLoop);
    timer = setInterval(() => {
      if (document.hidden) tick();
    }, 33);
    return () => {
      cancelAnimationFrame(raf);
      if (timer) clearInterval(timer);
    };
  }, []);

  const pickAvatar = useCallback((k: AvatarKind) => {
    setAvatar(k);
    setShowPicker(false);
    try {
      localStorage.setItem("ecoquest-avatar", k);
    } catch {}
  }, []);
  const dismissTutorial = useCallback(() => {
    setShowTutorial(false);
    try {
      localStorage.setItem(TUTORIAL_KEY, "done");
    } catch {}
  }, []);

  return (
    <div
      className="relative rounded-2xl overflow-hidden border-4 border-emerald-900/40 shadow-2xl select-none"
      style={{ height: "min(74vh, 720px)" }}
    >
      {/* ======= 3D canvas ======= */}
      {mounted && avatar && (
        <Canvas
          frameloop="always"
          shadows
          dpr={[1, 1.75]}
          camera={{ position: [0, 1.7, 4], fov: 68 }}
          className="!absolute inset-0"
        >
          <Scene
            store={store}
            markers={markers}
            nearType={nearStation?.type ?? null}
            airScore={orgScore}
            isDark={isDark}
            avatar={avatar}
          />
        </Canvas>
      )}

      {/* ======= HUD: hero card ======= */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-3 rounded-2xl bg-slate-900/80 backdrop-blur px-4 py-2.5 text-white shadow-lg">
        <div className="h-11 w-11 rounded-full bg-gradient-to-b from-emerald-400 to-green-600 flex items-center justify-center text-xl border-2 border-emerald-200">
          {avatar === "GIRL" ? "👧" : "👦"}
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

      {/* ======= HUD: coins/badges + minimap (top right) ======= */}
      <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          <div className="rounded-2xl bg-slate-900/80 backdrop-blur px-4 py-2 text-white shadow-lg flex items-center gap-2">
            <span className="eco-coin text-lg">🪙</span>
            <span className="font-bold text-amber-300">{hero.points}</span>
          </div>
          <div
            className="rounded-2xl bg-slate-900/80 backdrop-blur px-3 py-2 text-base shadow-lg"
            title={hero.badges.map((b) => b.name).join(", ") || "No badges yet"}
          >
            {hero.badges.length ? hero.badges.map((b) => b.icon).join(" ") : "🔒"}
          </div>
          <button
            onClick={() => setFpv((v) => !v)}
            className="h-10 w-10 rounded-2xl bg-slate-900/80 backdrop-blur text-white flex items-center justify-center shadow-lg hover:bg-slate-800 cursor-pointer"
            title={fpv ? "Third-person camera (C)" : "First-person camera (C)"}
          >
            <Video size={16} />
          </button>
          <button
            onClick={() => setShowPicker(true)}
            className="h-10 w-10 rounded-2xl bg-slate-900/80 backdrop-blur text-white flex items-center justify-center shadow-lg hover:bg-slate-800 cursor-pointer"
            title="Change avatar"
          >
            <UserRound size={16} />
          </button>
          <button
            onClick={() => setShowTutorial(true)}
            className="h-10 w-10 rounded-2xl bg-slate-900/80 backdrop-blur text-white flex items-center justify-center shadow-lg hover:bg-slate-800 cursor-pointer"
            title="How to play"
          >
            <HelpCircle size={16} />
          </button>
        </div>
        <Minimap store={store} markers={markers} nearType={nearStation?.type ?? null} />
      </div>

      {/* ======= controls hint + air quality ======= */}
      <div className="absolute bottom-3 left-3 z-20 flex flex-col gap-1.5">
        <div className="rounded-xl bg-slate-900/75 backdrop-blur px-3 py-1.5 text-[11px] text-white shadow-lg flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${orgScore >= 70 ? "bg-emerald-400" : orgScore >= 40 ? "bg-amber-400" : "bg-rose-400"}`} />
          Village air: <b>{orgScore}/100</b>
          <span className="text-slate-400 hidden sm:inline">— live {airLabel} score</span>
        </div>
        <div className="rounded-xl bg-slate-900/75 backdrop-blur px-3 py-1.5 text-[11px] text-slate-300 shadow-lg hidden md:flex items-center gap-2.5">
          <span><b className="text-white">↑↓←→</b> move</span>
          <span><b className="text-white">Shift</b> run</span>
          <span><b className="text-white">Space</b> jump</span>
          <span><b className="text-white">E</b> interact</span>
          <span><b className="text-white">C</b> camera</span>
        </div>
      </div>

      {/* ======= interact prompt ======= */}
      {nearStation && !openStation && !showTutorial && !showPicker && (
        <div className="absolute inset-x-0 bottom-16 z-20 flex justify-center pointer-events-none">
          <div className="eco-marker rounded-2xl bg-emerald-600/95 text-white font-bold text-sm px-5 py-2.5 shadow-xl border-2 border-emerald-300/60">
            ⏎ Press <span className="bg-emerald-800 rounded px-1.5 py-0.5 mx-0.5">E</span> — {nearStation.name}
            <span className="font-normal text-emerald-100 ml-1.5 hidden sm:inline">· {nearStation.tagline}</span>
          </div>
        </div>
      )}

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
                title="Close (Esc)"
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

      {showPicker && <AvatarPicker onPick={pickAvatar} />}
      {!showPicker && showTutorial && <Tutorial onDone={dismissTutorial} />}
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
                <div className="text-xs text-slate-400 mb-1">{r.description}</div>
                <div className="text-[10px] text-emerald-400/90 mb-2">📦 {meta.fulfillment}</div>
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
            <div className="text-xs uppercase tracking-wide text-emerald-400 font-bold mb-2">🎫 Your claim codes</div>
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
