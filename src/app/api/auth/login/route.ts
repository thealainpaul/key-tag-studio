import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createAdminToken, setAdminCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ success: false, error: "Email and password required" }, { status: 400 });
  }

  const admin = await prisma.admin.findUnique({ where: { email } });
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
    return NextResponse.json({ success: false, error: "Invalid credentials" }, { status: 401 });
  }

  const token = await createAdminToken(email);
  await setAdminCookie(token);
  return NextResponse.json({ success: true });
}
