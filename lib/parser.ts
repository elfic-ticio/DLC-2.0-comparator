import { ParsedLog } from "@/types";

const SECTION_MARKERS = [
  "[0]",
  "[1]",
  "[2]",
  "[3]",
  "[4]",
  "[5]",
  "[6]",
  "[7]",
];

function extractSection(log: string, sectionNum: number): string {
  const start = SECTION_MARKERS[sectionNum];
  const end = SECTION_MARKERS[sectionNum + 1] ?? null;

  const startIdx = log.indexOf(start);
  if (startIdx === -1) return "";

  const endIdx = end ? log.indexOf(end, startIdx + start.length) : log.length;
  return log.slice(startIdx, endIdx === -1 ? log.length : endIdx);
}

function extractValue(section: string, key: string): string | null {
  const lines = section.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith(key + ":") || trimmed.startsWith(key + "=")) {
      const sep = trimmed.includes(":") ? ":" : "=";
      const val = trimmed.slice(trimmed.indexOf(sep) + 1).trim();
      return val || null;
    }
    if (trimmed.startsWith(key + " ")) {
      const val = trimmed.slice(key.length).trim();
      if (val.startsWith(":") || val.startsWith("=")) return val.slice(1).trim() || null;
    }
  }
  return null;
}

function extractAllValues(section: string, key: string): string[] {
  const results: string[] = [];
  const lines = section.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed.toLowerCase().includes(key.toLowerCase() + ":") ||
      trimmed.toLowerCase().includes(key.toLowerCase() + "=") ||
      trimmed.toLowerCase().startsWith(key.toLowerCase())
    ) {
      const idx = Math.max(
        trimmed.toLowerCase().indexOf(key.toLowerCase() + ":"),
        trimmed.toLowerCase().indexOf(key.toLowerCase() + "=")
      );
      if (idx !== -1) {
        const sep = trimmed[idx + key.length];
        const val = trimmed.slice(idx + key.length + 1).trim();
        if (val) results.push(val);
      }
    }
  }
  return results;
}

export function parseLog(rawLog: string): ParsedLog {
  const result: ParsedLog = {
    serial: null,
    manufacturer: null,
    model: null,
    androidVersion: null,
    sdkVersion: null,
    buildType: null,
    avbState: null,
    bootloaderStatus: null,
    dlcPackages: [],
    apexModules: [],
    services: [],
    hasGlobalParametersService: false,
    hasSetupParametersService: false,
    hasDeviceLockQueryService: false,
    hasDeviceLockFirebaseService: false,
    simState: null,
    mccmnc: null,
    isoCountry: null,
    callScreeningValues: [],
    callRedirectionValues: [],
    carrierCertificateLines: [],
    detectedCertificates: [],
    carrierConfigApk: null,
    developerMode: null,
    usbDebugging: null,
    activeCarrierCheck: null,
    isValid: true,
    invalidReason: null,
    rawLog,
  };

  if (!rawLog || rawLog.trim().length < 50) {
    result.isValid = false;
    result.invalidReason = "INVALID: Empty or unrecognized log format";
    return result;
  }

  if (!rawLog.includes("[0]") && !rawLog.includes("[1]") && !rawLog.includes("[2]")) {
    result.isValid = false;
    result.invalidReason = "INVALID: Unrecognized log format";
    return result;
  }

  // Section [0] — Connected Device
  const sec0 = extractSection(rawLog, 0);
  if (sec0) {
    const lines = sec0.split("\n");
    for (const line of lines) {
      // "List of devices attached" block — serial is on the next non-empty line
      if (line.includes("List of devices attached")) {
        const idx = lines.indexOf(line);
        for (let i = idx + 1; i < lines.length; i++) {
          const next = lines[i].trim();
          if (next && !next.startsWith("[")) {
            const parts = next.split(/\s+/);
            if (parts.length >= 1 && parts[0] !== "device") {
              result.serial = parts[0];
            }
            break;
          }
        }
      }
      // Fallback: explicit "Serial:" line
      if (line.toLowerCase().includes("serial:")) {
        const val = line.split(":").slice(1).join(":").trim();
        if (val && !result.serial) result.serial = val;
      }
    }
    // Try to find serial from adb devices output pattern
    const serialMatch = sec0.match(/^([A-Za-z0-9]+)\s+device/m);
    if (serialMatch && !result.serial) {
      result.serial = serialMatch[1];
    }
  }

  const noDevice =
    sec0.includes("error") ||
    (sec0.includes("List of devices attached") && !result.serial && !rawLog.includes("[1]"));

  if (noDevice && !result.serial) {
    result.isValid = false;
    result.invalidReason = "INVALID: No device detected. Check ADB connection.";
    return result;
  }

  // Section [1] — Android Version / Manufacturer / Model
  const sec1 = extractSection(rawLog, 1);
  if (sec1) {
    const lines = sec1.split("\n");
    for (const line of lines) {
      const t = line.trim();
      if (/manufacturer/i.test(t)) {
        const val = t.split(/[=:]/)[1]?.trim();
        if (val) result.manufacturer = val;
      }
      if (/^model[=:\s]/i.test(t)) {
        const val = t.replace(/^model[=:\s]+/i, "").trim();
        if (val) result.model = val;
      }
      if (/release|android.version|ro\.build\.version\.release/i.test(t)) {
        const val = t.split(/[=:]/)[1]?.trim();
        if (val && !result.androidVersion) result.androidVersion = val;
      }
      if (/sdk_int|ro\.build\.version\.sdk/i.test(t)) {
        const val = t.split(/[=:]/)[1]?.trim();
        if (val && !result.sdkVersion) result.sdkVersion = val;
      }
      if (/build.type|ro\.build\.type/i.test(t)) {
        const val = t.split(/[=:]/)[1]?.trim();
        if (val && !result.buildType) result.buildType = val;
      }
    }
  }

  // Section [2] — Verified Boot & Bootloader
  const sec2 = extractSection(rawLog, 2);
  if (sec2) {
    const lines = sec2.split("\n");
    for (const line of lines) {
      const t = line.trim();
      if (/avb|verified.boot|verifiedBootState/i.test(t)) {
        const val = t.split(/[=:]/)[1]?.trim()?.toLowerCase();
        if (val && !result.avbState) result.avbState = val;
      }
      if (/bootloader|unlocked|lock_state/i.test(t)) {
        const val = t.split(/[=:]/)[1]?.trim();
        if (val !== undefined && !result.bootloaderStatus) result.bootloaderStatus = val;
      }
    }
  }

  // Section [3] — DLC Packages / Trustonic
  const sec3 = extractSection(rawLog, 3);
  if (sec3) {
    const lines = sec3.split("\n");
    for (const line of lines) {
      const t = line.trim();
      if (t.includes("dlc") || t.includes("trustonic") || t.includes("devicelock")) {
        if (t.startsWith("package:") || t.includes(".apk") || t.includes(".apex")) {
          result.dlcPackages.push(t);
        }
        if (t.includes("apex") && t.includes("versionCode")) {
          result.apexModules.push(t);
        }
      }
    }
  }

  // Section [4] — DLC Services in Activity Manager
  const sec4 = extractSection(rawLog, 4);
  if (sec4) {
    const serviceMatches = sec4.match(/\* ServiceRecord\{[^}]+\}\s+[\w./]+/g) ?? [];
    const altMatches = sec4.match(/com\.[a-z0-9._]+\/[a-z0-9._]+Service/gi) ?? [];
    const allServices = [
      ...serviceMatches.map((s) => s.replace(/.*\}\s+/, "").trim()),
      ...altMatches,
    ];
    result.services = Array.from(new Set(allServices));

    const fullSec4Lower = sec4.toLowerCase();

    result.hasGlobalParametersService =
      sec4.includes("GlobalParametersService") &&
      sec4.includes("com.google.android.devicelockcontroller");

    result.hasSetupParametersService =
      sec4.includes("SetupParametersService") &&
      sec4.includes("com.google.android.devicelockcontroller");

    result.hasDeviceLockQueryService =
      sec4.includes("DeviceLockQueryService") &&
      sec4.includes("com.transsion.phone.network");

    result.hasDeviceLockFirebaseService =
      sec4.includes("DeviceLockFirebaseMessagingService");
  }

  // Section [5] — CarrierConfig Critical Parameters
  const sec5 = extractSection(rawLog, 5);
  if (sec5) {
    const lines = sec5.split("\n");
    let currentKey = "";

    for (const line of lines) {
      const t = line.trim();

      // SIM state
      if (/SIM.STATE|sim_state/i.test(t)) {
        const val = t.split(/[=:]/)[1]?.trim();
        if (val && !result.simState) result.simState = val;
      }

      // MCC/MNC
      if (/mccmnc|MCC.*MNC|operator/i.test(t) && !result.mccmnc) {
        const val = t.split(/[=:]/)[1]?.trim();
        if (val) result.mccmnc = val;
      }

      // ISO country
      if (/iso.*country|country.iso/i.test(t) && !result.isoCountry) {
        const val = t.split(/[=:]/)[1]?.trim();
        if (val) result.isoCountry = val;
      }

      // call_screening_app — collect all lines
      if (/call_screening_app/i.test(t)) {
        const colonIdx = t.indexOf(":");
        const eqIdx = t.indexOf("=");
        const sepIdx = Math.max(colonIdx, eqIdx);
        if (sepIdx !== -1) {
          const val = t.slice(sepIdx + 1).trim();
          if (val) result.callScreeningValues.push(val);
        } else if (t.length > "call_screening_app".length) {
          result.callScreeningValues.push(t);
        }
      }

      // call_redirection
      if (/call_redirection/i.test(t)) {
        const colonIdx = t.indexOf(":");
        const eqIdx = t.indexOf("=");
        const sepIdx = Math.max(colonIdx, eqIdx);
        if (sepIdx !== -1) {
          const val = t.slice(sepIdx + 1).trim();
          if (val) result.callRedirectionValues.push(val);
        }
      }

      // carrier_certificate — collect all lines
      if (/carrier_certificate|certificate/i.test(t)) {
        result.carrierCertificateLines.push(t);
        if (t.includes("com.trustonic.telecoms.standard.dlc")) {
          result.detectedCertificates.push("com.trustonic.telecoms.standard.dlc");
        }
        if (t.includes("com.trustonic.telecoms.standard.dpc")) {
          result.detectedCertificates.push("com.trustonic.telecoms.standard.dpc");
        }
        if (t.includes("co.sitic.pp")) {
          result.detectedCertificates.push("co.sitic.pp");
        }
      }

      // CarrierConfig APK
      if (/carrierconfig.*apk|apk.*carrierconfig/i.test(t)) {
        const val = t.split(/[=:]/)[1]?.trim();
        if (val && !result.carrierConfigApk) result.carrierConfigApk = val;
      }
    }

    // Deduplicate certificates
    result.detectedCertificates = Array.from(new Set(result.detectedCertificates));
  }

  // Section [6] — Developer Mode and ADB Status
  const sec6 = extractSection(rawLog, 6);
  if (sec6) {
    const lines = sec6.split("\n");
    for (const line of lines) {
      const t = line.trim();
      if (/developer.mode|development_settings/i.test(t)) {
        const val = t.split(/[=:]/)[1]?.trim();
        if (val !== undefined && !result.developerMode) result.developerMode = val;
      }
      if (/adb|usb.debug/i.test(t)) {
        const val = t.split(/[=:]/)[1]?.trim();
        if (val !== undefined && !result.usbDebugging) result.usbDebugging = val;
      }
    }
  }

  // Section [7] — Carrier ID
  const sec7 = extractSection(rawLog, 7);
  if (sec7) {
    const lines = sec7.split("\n");
    for (const line of lines) {
      const t = line.trim();
      if (/carrier.id|activeCarrier|active_carrier/i.test(t)) {
        const val = t.split(/[=:]/)[1]?.trim();
        if (val && !result.activeCarrierCheck) result.activeCarrierCheck = val;
      }
    }
  }

  return result;
}
