import { NextRequest, NextResponse } from "next/server";
import { getVerification, deleteVerification } from "@/lib/kv";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const v = await getVerification(decodeURIComponent(id));
    if (!v) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ verification: v });
  } catch (err) {
    console.error("GET verification error:", err);
    return NextResponse.json({ error: "Failed to fetch verification" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteVerification(decodeURIComponent(id));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE verification error:", err);
    return NextResponse.json({ error: "Failed to delete verification" }, { status: 500 });
  }
}
