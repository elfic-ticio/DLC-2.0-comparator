import { NextRequest, NextResponse } from "next/server";
import { listVerifications } from "@/lib/kv";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const model = searchParams.get("model") ?? undefined;
    const resultFilter = searchParams.get("result") as "PASS" | "FAIL" | null;
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    const verifications = await listVerifications({
      model,
      result: resultFilter ?? undefined,
      limit,
      offset,
    });

    return NextResponse.json({ verifications, total: verifications.length });
  } catch (err) {
    console.error("GET history error:", err);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}
