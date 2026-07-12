import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "./db";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev-secret");

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "EMPLOYEE";
  departmentId: string | null;
};

export async function createSession(user: SessionUser) {
  const token = await new SignJWT(user)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("12h")
    .sign(secret);
  const store = await cookies();
  store.set("session", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get("session")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const s = await getSession();
  if (!s) throw new Error("Not authenticated");
  return s;
}

export async function requireRole(...roles: string[]): Promise<SessionUser> {
  const s = await requireUser();
  if (!roles.includes(s.role)) throw new Error("Not authorized");
  return s;
}

export async function destroySession() {
  const store = await cookies();
  store.delete("session");
}

/** Fresh user row (xp/points change often — session only carries identity). */
export async function currentUser() {
  const s = await getSession();
  if (!s) return null;
  return db.user.findUnique({ where: { id: s.id }, include: { department: true } });
}
