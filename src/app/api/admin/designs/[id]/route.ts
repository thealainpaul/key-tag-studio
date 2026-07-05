import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const design = await prisma.design.findUnique({ where: { id } });
  if (!design) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ design });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { designJson, previewDataUrl } = await req.json();

  if (!designJson) {
    return NextResponse.json({ error: "designJson required" }, { status: 400 });
  }

  const parsed = typeof designJson === "string" ? JSON.parse(designJson) : designJson;

  await prisma.design.update({
    where: { id },
    data: {
      designJson: typeof designJson === "string" ? designJson : JSON.stringify(designJson),
      previewDataUrl: previewDataUrl ?? undefined,
      tagColor: parsed.tagColor || undefined,
    },
  });

  return NextResponse.json({ success: true });
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { action, reason } = await req.json();

  if (action === "approve") {
    await prisma.design.update({ where: { id }, data: { status: "approved", rejectionReason: null } });
  } else if (action === "reject") {
    await prisma.design.update({ where: { id }, data: { status: "rejected", rejectionReason: reason || "Rejected" } });
  } else {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.design.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
