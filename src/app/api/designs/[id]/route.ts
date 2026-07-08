import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function authorized(req: NextRequest) {
  const secret = process.env.BIK_WP_SHARED_SECRET;
  if (!secret) return false;
  const header =
    req.headers.get("x-bik-ckt-secret") ||
    req.headers.get("x-bik-secret") ||
    "";
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  return header === secret || bearer === secret;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const design = await prisma.design.findUnique({ where: { id } });
  if (!design) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: design.id,
    status: design.status,
    paymentStatus: design.paymentStatus,
    tagColor: design.tagColor,
    previewDataUrl: design.previewDataUrl,
    locale: design.locale,
    wooOrderId: design.wooOrderId,
    createdAt: design.createdAt,
    updatedAt: design.updatedAt,
  });
}

/** Mark design paid after WooCommerce payment (called from WP plugin). */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const wooOrderId = typeof body.wooOrderId === "string" ? body.wooOrderId : null;

  try {
    const design = await prisma.design.update({
      where: { id },
      data: {
        paymentStatus: "paid",
        status: "approved",
        paidAt: new Date(),
        wooOrderId,
      },
    });
    return NextResponse.json({ success: true, id: design.id, paymentStatus: design.paymentStatus });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
