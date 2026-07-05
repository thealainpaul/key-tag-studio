import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { DesignPayload } from "@/lib/design";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { tagColor, designJson, previewDataUrl } = body;

  if (!designJson) {
    return NextResponse.json({ success: false, error: "Design data required" }, { status: 400 });
  }

  const parsed: DesignPayload = typeof designJson === "string" ? JSON.parse(designJson) : designJson;
  const source = parsed.fitMode === "auto" ? "auto_fit" : "manual";

  const design = await prisma.design.create({
    data: {
      tagColor: tagColor || "#1f1f1f",
      designJson: typeof designJson === "string" ? designJson : JSON.stringify(designJson),
      previewDataUrl: previewDataUrl || null,
      status: "pending",
      source,
    },
  });

  return NextResponse.json({ success: true, id: design.id });
}
