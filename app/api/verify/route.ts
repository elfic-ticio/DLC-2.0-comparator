import { NextRequest, NextResponse } from "next/server";
import { parseLog } from "@/lib/parser";
import { compare } from "@/lib/comparator";
import { getCurrentReference, saveVerification } from "@/lib/kv";
import { StoredVerification } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("log") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No log file provided" }, { status: 400 });
    }

    const rawLog = await file.text();
    const device = parseLog(rawLog);

    if (!device.isValid) {
      return NextResponse.json(
        { error: device.invalidReason ?? "Invalid log file" },
        { status: 422 }
      );
    }

    const reference = await getCurrentReference();
    if (!reference) {
      return NextResponse.json(
        { error: "No reference device configured. Please upload a reference log first." },
        { status: 428 }
      );
    }

    const result = compare(device, reference);

    // Persist to KV
    const stored: StoredVerification = {
      id: "",
      model: device.model ?? "Unknown",
      serial: device.serial ?? "Unknown",
      manufacturer: device.manufacturer ?? "Unknown",
      androidVersion: device.androidVersion ?? "N/A",
      sdkVersion: device.sdkVersion ?? "N/A",
      simState: device.simState ?? "N/A",
      mccmnc: device.mccmnc ?? "N/A",
      avbState: device.avbState ?? "N/A",
      bootloaderStatus: device.bootloaderStatus ?? "N/A",
      referenceModel: reference.model,
      results: {
        globalParametersService: result.criteria.globalParametersService.pass,
        callScreening: result.criteria.callScreening.pass,
        callRedirection: result.criteria.callRedirection.pass,
        carrierCertificates: result.criteria.carrierCertificates.pass,
      },
      warnings: result.warnings,
      overallPass: result.overallPass,
      date: result.timestamp,
      rawLog,
    };

    await saveVerification(stored);

    return NextResponse.json({ result, stored });
  } catch (err) {
    console.error("Verify error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
