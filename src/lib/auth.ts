import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

const COOKIE = "rewardconnection_session";
const ISSUER = "rewardconnection";
const AUDIENCE = "rewardconnection-web";

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET must be at least 32 characters");
  return new TextEncoder().encode(value);
}

function secureCookie() {
  const override = process.env.AUTH_COOKIE_SECURE?.trim().toLowerCase();
  if (override === "true") return true;
  if (override === "false") return false;
  return (process.env.APP_URL || "").startsWith("https://");
}

export async function createSession(userId: string) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: secureCookie(),
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getCurrentUser() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (!payload.sub) return null;
    return prisma.user.findUnique({
      where: { id: payload.sub },
      include: { wallet: true },
    });
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function requireParent() {
  const user = await requireUser();
  if (user.role !== "PARENT") throw new Error("FORBIDDEN");
  return user;
}

export async function requireChild() {
  const user = await requireUser();
  if (user.role !== "CHILD") throw new Error("FORBIDDEN");
  return user;
}
