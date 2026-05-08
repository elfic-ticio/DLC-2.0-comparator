import { ParsedLog } from "@/types";

/*
 * Real log format (from the actual DLC verification script):
 *
 *   MANUFACTURER:
 *   TECNO
 *   MODEL:
 *   TECNO KM8n
 *
 *   ANDROID VERIFIED BOOT - AVB AUTHENTIC ROM:
 *   green
 *
 *   BOOTLOADER STATUS:
 *   1
 *
 *   DEVELOPER MODE CHECK:
 *   1
 *
 * Section [5] uses indented key = value pairs:
 *   call_screening_app =
 *   call_screening_app = com.trustonic...
 *
 * The script also emits [OK] / [FAIL] confirmation lines for certificates.
 */

const SECTION_MARKERS = ["[0]", "[1]", "[2]", "[3]", "[4]", "[5]", "[6]", "[7]"];

function extractSection(log: string, sectionNum: number): string {
  const start = SECTION_MARKERS[sectionNum];
  const end = SECTION_MARKERS[sectionNum + 1] ?? null;
  const startIdx = log.indexOf(start);
  if (startIdx === -1) return "";
  const endIdx = end ? log.indexOf(end, startIdx + start.length) : log.length;
  return log.slice(startIdx, endIdx === -1 ? log.length : endIdx);
}

// Lines to skip when looking for a value after a label
function isNoise(line: string): boolean {
  const t = line.trim();
  return (
    !t ||
    t.startsWith("Nota:") ||
    t.startsWith("Solucion:") ||
    t.startsWith("Ejemplo") ||
    t.startsWith("===") ||
    t.startsWith("App y servicio") ||
    t.startsWith("Generated") ||
    t.startsWith("End of")
  );
}

/**
 * Find a label line matching the pattern, then return the value on the very
 * next non-noise line. This is the primary extraction strategy for this log format.
 */
function extractNextLineValue(section: string, labelPattern: RegExp): string | null {
  const lines = section.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    // Must end with ":" to be a label line, not a section header
    if (t.endsWith(":") && labelPattern.test(t)) {
      for (let j = i + 1; j < lines.length; j++) {
        if (isNoise(lines[j])) continue;
        const v = lines[j].trim();
        if (v) return v;
        break;
      }
    }
  }
  return null;
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

  const hasAnySectionMarker = SECTION_MARKERS.some((m) => rawLog.includes(m));
  if (!hasAnySectionMarker) {
    result.isValid = false;
    result.invalidReason = "INVALID: Unrecognized log format";
    return result;
  }

  // ── Section [0] — Connected Device ─────────────────────────────────────────
  const sec0 = extractSection(rawLog, 0);
  {
    const lines = sec0.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (t.includes("List of devices attached")) {
        for (let j = i + 1; j < lines.length; j++) {
          const next = lines[j].trim();
          if (!next) continue;
          // Format: SERIAL\tdevice  or  SERIAL device
          const parts = next.split(/\s+/);
          if (parts[0] && parts[0] !== "device" && parts[0] !== "*") {
            result.serial = parts[0];
          }
          break;
        }
      }
    }

    if (!result.serial) {
      // Fallback: any line matching SERIALNUMBER\tdevice
      const m = sec0.match(/^([A-Za-z0-9_\-\.]+)\s+device\b/m);
      if (m && m[1] !== "device") result.serial = m[1];
    }
  }

  if (
    sec0.includes("error: no devices") ||
    sec0.includes("error: device not found") ||
    (sec0.includes("List of devices attached") &&
      !result.serial &&
      !extractSection(rawLog, 1).trim())
  ) {
    result.isValid = false;
    result.invalidReason = "INVALID: No device detected. Check ADB connection.";
    return result;
  }

  // ── Section [1] — Android Version / Manufacturer / Model ───────────────────
  // Format in real logs:
  //   MANUFACTURER:
  //   TECNO
  //   MODEL:
  //   TECNO KM8n
  const sec1 = extractSection(rawLog, 1);
  {
    result.manufacturer = extractNextLineValue(sec1, /MANUFACTURER/i);
    result.model        = extractNextLineValue(sec1, /^MODEL\s*:/i);
    result.androidVersion = extractNextLineValue(sec1, /ANDROID VERSION/i);
    result.sdkVersion   = extractNextLineValue(sec1, /SDK VERSION/i);
    result.buildType    = extractNextLineValue(sec1, /BUILD TYPE/i);

    // Filter out noise values that are actually notes/labels
    for (const k of ["manufacturer", "model", "androidVersion", "sdkVersion", "buildType"] as const) {
      const v = result[k];
      if (v && (v.startsWith("Nota:") || v.startsWith("===") || v.startsWith("["))) {
        result[k] = null;
      }
    }
  }

  // ── Section [2] — Verified Boot & Bootloader ────────────────────────────────
  // Format:
  //   ANDROID VERIFIED BOOT - AVB AUTHENTIC ROM:
  //   green
  //
  //   BOOTLOADER STATUS:
  //   1
  const sec2 = extractSection(rawLog, 2);
  {
    const avb = extractNextLineValue(sec2, /AVB|VERIFIED BOOT/i);
    if (avb && /^(green|yellow|orange|red)$/i.test(avb)) {
      result.avbState = avb.toLowerCase();
    }

    const bl = extractNextLineValue(sec2, /BOOTLOADER STATUS/i);
    if (bl && /^[01]$/.test(bl.trim())) {
      result.bootloaderStatus = bl.trim();
    }
  }

  // ── Section [3] — DLC Packages / Trustonic ──────────────────────────────────
  const sec3 = extractSection(rawLog, 3);
  {
    const lines = sec3.split("\n");
    for (const line of lines) {
      const t = line.trim();
      if (t.startsWith("package:")) {
        result.dlcPackages.push(t);
      }
    }
  }

  // ── Section [4] — DLC Services in Activity Manager ──────────────────────────
  const sec4 = extractSection(rawLog, 4);
  {
    // Extract service component names from ServiceRecord lines
    const serviceMatches = sec4.match(/\* ServiceRecord\{[^}]+\}\s+([\w./]+)/g) ?? [];
    const altMatches = sec4.match(/cmp=([\w./]+Service)/g)?.map((s) => s.replace("cmp=", "")) ?? [];
    const allServices = [
      ...serviceMatches.map((s) => {
        const m = s.match(/\* ServiceRecord\{[^}]+\}\s+([\w./]+)/);
        return m ? m[1] : "";
      }),
      ...altMatches,
    ].filter(Boolean);
    result.services = Array.from(new Set(allServices));

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

  // ── Section [5] — CarrierConfig Critical Parameters ─────────────────────────
  // Format: indented key = value lines, possibly multiple per key (multi-profile)
  //   call_screening_app =
  //   call_screening_app = com.trustonic...
  //   carrier_certificate_string_array = []
  //   carrier_certificate_string_array = [SHA:pkg, ...]
  const sec5 = extractSection(rawLog, 5);
  {
    const lines = sec5.split("\n");
    for (const line of lines) {
      const t = line.trim();

      // call_screening_app = value
      if (/^call_screening_app\s*=/i.test(t)) {
        const v = t.slice(t.indexOf("=") + 1).trim();
        if (v) result.callScreeningValues.push(v);
      }

      // call_redirection_service_component_name_string = value
      if (/^call_redirection_service/i.test(t) && t.includes("=")) {
        const v = t.slice(t.indexOf("=") + 1).trim();
        if (v && v !== "null") result.callRedirectionValues.push(v);
      }

      // carrier_certificate_string_array = [...]
      if (/^carrier_certificate_string_array\s*=/i.test(t)) {
        const v = t.slice(t.indexOf("=") + 1).trim();
        if (v && v !== "[]") {
          result.carrierCertificateLines.push(v);
          if (v.includes("com.trustonic.telecoms.standard.dlc")) {
            result.detectedCertificates.push("com.trustonic.telecoms.standard.dlc");
          }
          if (v.includes("com.trustonic.telecoms.standard.dpc")) {
            result.detectedCertificates.push("com.trustonic.telecoms.standard.dpc");
          }
          if (v.includes("co.sitic.pp")) {
            result.detectedCertificates.push("co.sitic.pp");
          }
        }
      }

      // The script itself outputs [OK] lines — trust them as ground truth
      if (t.includes("[OK]") && /certificado.*dlc/i.test(t)) {
        result.detectedCertificates.push("com.trustonic.telecoms.standard.dlc");
      }
      if (t.includes("[OK]") && /certificado.*dpc/i.test(t)) {
        result.detectedCertificates.push("com.trustonic.telecoms.standard.dpc");
      }
      if (t.includes("[OK]") && /certificado.*sitic/i.test(t)) {
        result.detectedCertificates.push("co.sitic.pp");
      }

      // SIM state (if present)
      if (/SIM.STATE|sim_state|SIM_STATE/i.test(t) && !result.simState) {
        const v = t.split(/[=:]/)[1]?.trim();
        if (v) result.simState = v;
      }

      // MCC/MNC
      if (/mccmnc|operator_numeric/i.test(t) && !result.mccmnc) {
        const v = t.split(/[=:]/)[1]?.trim();
        if (v) result.mccmnc = v;
      }

      // CarrierConfig APK
      if (/carrierconfig.*\.apk/i.test(t) && !result.carrierConfigApk) {
        result.carrierConfigApk = t;
      }
    }

    result.detectedCertificates = Array.from(new Set(result.detectedCertificates));
  }

  // ── Section [6] — Developer Mode and ADB Status ─────────────────────────────
  // Format:
  //   DEVELOPER MODE CHECK:
  //   1
  //   USB DEBUGGING STATE:
  //   1
  const sec6 = extractSection(rawLog, 6);
  {
    const devMode = extractNextLineValue(sec6, /DEVELOPER MODE/i);
    if (devMode && /^[01]$/.test(devMode.trim())) {
      result.developerMode = devMode.trim();
    }

    const usbDebug = extractNextLineValue(sec6, /USB DEBUGGING/i);
    if (usbDebug && /^[01]$/.test(usbDebug.trim())) {
      result.usbDebugging = usbDebug.trim();
    }
  }

  // ── Section [7] — Carrier ID ─────────────────────────────────────────────────
  const sec7 = extractSection(rawLog, 7);
  {
    const carrierId = extractNextLineValue(sec7, /ACTIVE CARRIER CHECK/i);
    if (carrierId) result.activeCarrierCheck = carrierId;
  }

  return result;
}
