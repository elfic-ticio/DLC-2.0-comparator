import { NextResponse } from "next/server";
import { getReferenceHistory } from "@/lib/kv";

export async function GET() {
  try {
    const history = await getReferenceHistory();
    return NextResponse.json({ history });
  } catch (err) {
    console.error("GET reference history error:", err);
    return NextResponse.json({ error: "Failed to fetch reference history" }, { status: 500 });
  }
}
