import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { tagColor, designJson, previewDataUrl } = body;

  if (!designJson) {
    return NextResponse.json({ success: false, error: "Design data required" }, { status: 400 });
  }

  const design = await prisma.design.create({
    data: {
      tagColor: tagColor || "#1f1f1f",
      designJson: typeof designJson === "string" ? designJson : JSON.stringify(designJson),
      previewDataUrl: previewDataUrl || null,
      status: "pending",
      source: "manual",
    },
  });

  return NextResponse.json({ success: true, id: design.id });
}
