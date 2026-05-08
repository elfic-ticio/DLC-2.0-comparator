import { NextRequest, NextResponse } from "next/server";
import { parseLog } from "@/lib/parser";
import { getCurrentReference, saveReference, getReferenceHistory } from "@/lib/kv";
import { ReferenceDevice } from "@/types";

export async function GET() {
  try {
    const ref = await getCurrentReference();
    return NextResponse.json({ reference: ref });
  } catch (err) {
    console.error("GET reference error:", err);
    return NextResponse.json({ error: "Failed to fetch reference" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("log") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No log file provided" }, { status: 400 });
    }

    const rawLog = await file.text();
    const parsed = parseLog(rawLog);

    if (!parsed.isValid) {
      return NextResponse.json(
        { error: parsed.invalidReason ?? "Invalid log file" },
        { status: 422 }
      );
    }

    if (!parsed.model) {
      return NextResponse.json(
        { error: "Could not determine device model from log file" },
        { status: 422 }
      );
    }

    const ref: ReferenceDevice = {
      model: parsed.model,
      serial: parsed.serial ?? "Unknown",
      manufacturer: parsed.manufacturer ?? "Unknown",
      androidVersion: parsed.androidVersion ?? "N/A",
      sdkVersion: parsed.sdkVersion ?? "N/A",
      uploadedAt: new Date().toISOString(),
      services: parsed.services,
      hasGlobalParametersService: parsed.hasGlobalParametersService,
      hasCallScreening:
        parsed.callScreeningValues.some((v) =>
          v.includes("com.trustonic.telecoms.standard.dlc")
        ),
      callScreeningValue: parsed.callScreeningValues.join(" | "),
      hasCallRedirection:
        parsed.callRedirectionValues.some((v) =>
          v.includes("com.trustonic.telecoms.standard.dlc")
        ),
      callRedirectionValue: parsed.callRedirectionValues.join(" | "),
      hasCarrierCertificates: parsed.detectedCertificates.length >= 3,
      certificates: parsed.detectedCertificates,
      rawLog,
    };

    await saveReference(ref);

    return NextResponse.json({ reference: ref });
  } catch (err) {
    console.error("POST reference error:", err);
    return NextResponse.json({ error: "Failed to save reference" }, { status: 500 });
  }
}
