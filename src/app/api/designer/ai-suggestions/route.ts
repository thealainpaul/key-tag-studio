import { NextResponse } from "next/server";

export async function POST() {
  const suggestions = [
  { textLines: [{ text: "RETURN TO POSTBOX", y: 0.25 }, { text: "DROP IN MAILBOX", y: 0.75 }] },
  { textLines: [{ text: "IF FOUND", y: 0.3 }, { text: "PLEASE CALL", y: 0.7 }] },
  { textLines: [{ text: "KEY TAG", y: 0.5 }] },
  ];
  return NextResponse.json({ success: true, suggestions });
}
