import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Delete unpaid designs older than 30 days. Call via cron / Render cron. */
export async function POST(req: Request) {
  const secret = process.env.BIK_WP_SHARED_SECRET || process.env.CRON_SECRET;
  const header =
    req.headers.get("x-bik-ckt-secret") ||
    req.headers.get("x-bik-secret") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || header !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const result = await prisma.design.deleteMany({
    where: {
      paymentStatus: "unpaid",
      createdAt: { lt: cutoff },
    },
  });

  return NextResponse.json({ success: true, deleted: result.count });
}
