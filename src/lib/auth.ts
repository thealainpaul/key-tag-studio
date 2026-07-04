import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "kts_admin";
const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");

export async function createAdminToken(email: string) {
  return new SignJWT({ email, role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret);
}

export async function getAdminSession() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as { email: string; role: string };
  } catch {
    return null;
  }
}

export async function setAdminCookie(token: string) {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearAdminCookie() {
  (await cookies()).delete(COOKIE);
}

export { COOKIE };
