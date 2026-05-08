import { ParsedLog } from "@/types";

const SECTION_MARKERS = ["[0]", "[1]", "[2]", "[3]", "[4]", "[5]", "[6]", "[7]"];

function extractSection(log: string, sectionNum: number): string {
  const start = SECTION_MARKERS[sectionNum];
  const end = SECTION_MARKERS[sectionNum + 1] ?? null;
  const startIdx = log.indexOf(start);
  if (startIdx === -1) return "";
  const endIdx = end ? log.indexOf(end, startIdx + start.length) : log.length;
  return log.slice(startIdx, endIdx === -1 ? log.length : endIdx);
}

/**
 * Extract a value from a line using multiple formats:
 *   [ro.product.model]: [TECNO LG7n]
 *   ro.product.model=TECNO LG7n
 *   ro.product.model = TECNO LG7n
 *   getprop ro.product.model TECNO LG7n
 *   Model: TECNO LG7n
 *   Model = TECNO LG7n
 */
function extractProp(lines: string[], ...keys: string[]): string | null {
  for (const line of lines) {
    const t = line.trim();
    for (const key of keys) {
      const kLow = key.toLowerCase();
      const tLow = t.toLowerCase();

      // Format: [key]: [value]
      const bracketMatch = t.match(
        new RegExp(`\\[${key.replace(/\./g, "\\.")}\\]\\s*:\\s*\\[([^\\]]*)\\]`, "i")
      );
      if (bracketMatch) {
        const v = bracketMatch[1].trim();
        if (v) return v;
      }

      // Format: key=value  or  key = value
      if (tLow.startsWith(kLow + "=") || tLow.startsWith(kLow + " =")) {
        const v = t.slice(t.indexOf("=") + 1).trim();
        if (v) return v;
      }

      // Format: key: value  or  key : value
      if (tLow.startsWith(kLow + ":") || tLow.startsWith(kLow + " :")) {
        const v = t.slice(t.indexOf(":") + 1).trim();
        if (v) return v;
      }

      // Format: getprop key value
      if (tLow.startsWith("getprop " + kLow)) {
        const after = t.slice(("getprop " + key).length).trim();
        if (after.startsWith("=")) {
          const v = after.slice(1).trim();
          if (v) return v;
        } else if (after) {
          return after;
        }
      }

      // Format: key followed by space then value (label format)
      // Only apply for short simple keys like "model", "manufacturer"
      if (!key.includes(".") && tLow.startsWith(kLow + " ")) {
        const rest = t.slice(key.length).trim();
        if (rest && !rest.startsWith("[") && !rest.toLowerCase().startsWith(kLow)) {
          return rest;
        }
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

  if (!rawLog.includes("[0]") && !rawLog.includes("[1]") && !rawLog.includes("[2]")) {
    result.isValid = false;
    result.invalidReason = "INVALID: Unrecognized log format";
    return result;
  }

  // ── Section [0] — Connected Device ─────────────────────────────────────────
  const sec0 = extractSection(rawLog, 0);
  if (sec0) {
    const lines = sec0.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();

      // "List of devices attached" — serial is on the next non-empty line
      if (t.includes("List of devices attached")) {
        for (let j = i + 1; j < lines.length; j++) {
          const next = lines[j].trim();
          if (next && !next.startsWith("[")) {
            // Format: SERIAL\tdevice   or   SERIAL device
            const parts = next.split(/\s+/);
            if (parts[0] && parts[0] !== "device" && parts[0] !== "*") {
              result.serial = parts[0];
            }
            break;
          }
        }
      }

      // Serial: VALUE  or  serial number: VALUE
      if (/serial/i.test(t) && (t.includes(":") || t.includes("="))) {
        const v = t.split(/[=:]/)[1]?.trim();
        if (v && !result.serial) result.serial = v;
      }
    }

    // Fallback regex for "SERIAL device" pattern anywhere in sec0
    if (!result.serial) {
      const m = sec0.match(/^([A-Za-z0-9_\-\.]+)\s+device\b/m);
      if (m && m[1] !== "device") result.serial = m[1];
    }
  }

  const noDevice =
    sec0.includes("error: no devices") ||
    sec0.includes("error: device not found") ||
    (sec0.includes("List of devices attached") &&
      !result.serial &&
      sec0.split("\n").filter((l) => l.trim() && !l.includes("List of devices")).length === 0);

  if (noDevice) {
    result.isValid = false;
    result.invalidReason = "INVALID: No device detected. Check ADB connection.";
    return result;
  }

  // ── Section [1] — Android Version / Manufacturer / Model ───────────────────
  const sec1 = extractSection(rawLog, 1);
  if (sec1) {
    const lines = sec1.split("\n");

    result.manufacturer = extractProp(lines,
      "ro.product.manufacturer",
      "ro.product.brand",
      "manufacturer",
      "brand",
    );

    result.model = extractProp(lines,
      "ro.product.model",
      "ro.product.name",
      "model",
    );

    result.androidVersion = extractProp(lines,
      "ro.build.version.release",
      "ro.system.build.version.release",
      "android.version",
      "release",
    );

    result.sdkVersion = extractProp(lines,
      "ro.build.version.sdk",
      "ro.system.build.version.sdk",
      "sdk_int",
      "sdk",
    );

    result.buildType = extractProp(lines,
      "ro.build.type",
      "ro.system.build.type",
      "build.type",
      "build_type",
    );

    // Fallback: scan every line for known prop patterns if still null
    if (!result.model || !result.manufacturer) {
      for (const line of lines) {
        const t = line.trim();

        if (!result.manufacturer) {
          // [ro.product.manufacturer]: [TECNO]
          const m = t.match(/ro\.product\.(manufacturer|brand)[^\]]*\]\s*:\s*\[([^\]]+)\]/i)
            ?? t.match(/ro\.product\.(manufacturer|brand)\s*[=:]\s*(\S+.*)/i);
          if (m) result.manufacturer = m[2].trim();
        }

        if (!result.model) {
          // [ro.product.model]: [TECNO LG7n]
          const m = t.match(/ro\.product\.(model|name)[^\]]*\]\s*:\s*\[([^\]]+)\]/i)
            ?? t.match(/ro\.product\.(model|name)\s*[=:]\s*(.+)/i);
          if (m) result.model = m[2].trim();
        }

        if (!result.androidVersion) {
          const m = t.match(/ro\.build\.version\.release[^\]]*\]\s*:\s*\[([^\]]+)\]/i)
            ?? t.match(/ro\.build\.version\.release\s*[=:]\s*(\S+)/i);
          if (m) result.androidVersion = m[1].trim();
        }

        if (!result.sdkVersion) {
          const m = t.match(/ro\.build\.version\.sdk[^\]]*\]\s*:\s*\[([^\]]+)\]/i)
            ?? t.match(/ro\.build\.version\.sdk\s*[=:]\s*(\S+)/i);
          if (m) result.sdkVersion = m[1].trim();
        }

        if (!result.buildType) {
          const m = t.match(/ro\.build\.type[^\]]*\]\s*:\s*\[([^\]]+)\]/i)
            ?? t.match(/ro\.build\.type\s*[=:]\s*(\S+)/i);
          if (m) result.buildType = m[1].trim();
        }
      }
    }

    // Strip brackets from values like "[TECNO LG7n]"
    for (const k of ["manufacturer", "model", "androidVersion", "sdkVersion", "buildType"] as const) {
      if (result[k]) {
        result[k] = (result[k] as string).replace(/^\[|\]$/g, "").trim() || null;
      }
    }
  }

  // ── Section [2] — Verified Boot & Bootloader ────────────────────────────────
  const sec2 = extractSection(rawLog, 2);
  if (sec2) {
    const lines = sec2.split("\n");

    const avb = extractProp(lines,
      "ro.boot.verifiedbootstate",
      "ro.boot.veritymode",
      "verifiedBootState",
      "avb_state",
      "avb",
    );
    if (avb) result.avbState = avb.toLowerCase();

    // Fallback scan
    if (!result.avbState) {
      for (const line of lines) {
        const t = line.trim();
        const m = t.match(/verifiedboot[^\]]*\]\s*:\s*\[([^\]]+)\]/i)
          ?? t.match(/verifiedbootstate\s*[=:]\s*(\S+)/i)
          ?? t.match(/avb[^\]]*\]\s*:\s*\[([^\]]+)\]/i);
        if (m) { result.avbState = m[1].trim().toLowerCase(); break; }
      }
    }

    const bl = extractProp(lines,
      "ro.boot.flash.locked",
      "ro.secureboot.lockstate",
      "bootloader_status",
      "bootloader",
      "lock_state",
    );
    if (bl) result.bootloaderStatus = bl;

    // Scan for locked/unlocked state
    if (!result.bootloaderStatus) {
      for (const line of lines) {
        const t = line.trim();
        if (/locked/i.test(t)) {
          const m = t.match(/\b(locked|unlocked|1|0)\b/i);
          if (m) {
            result.bootloaderStatus =
              m[1].toLowerCase() === "locked" ? "1" :
              m[1].toLowerCase() === "unlocked" ? "0" : m[1];
          }
        }
      }
    }
  }

  // ── Section [3] — DLC Packages / Trustonic ──────────────────────────────────
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

  // ── Section [4] — DLC Services in Activity Manager ──────────────────────────
  const sec4 = extractSection(rawLog, 4);
  if (sec4) {
    const serviceMatches = sec4.match(/\* ServiceRecord\{[^}]+\}\s+[\w./]+/g) ?? [];
    const altMatches = sec4.match(/com\.[a-z0-9._]+\/[a-z0-9._]+Service/gi) ?? [];
    const allServices = [
      ...serviceMatches.map((s) => s.replace(/.*\}\s+/, "").trim()),
      ...altMatches,
    ];
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
  const sec5 = extractSection(rawLog, 5);
  if (sec5) {
    const lines = sec5.split("\n");

    for (const line of lines) {
      const t = line.trim();

      // SIM state
      if (/SIM.STATE|sim_state|SIM_STATE/i.test(t) && !result.simState) {
        const v = t.split(/[=:]/)[1]?.trim();
        if (v) result.simState = v;
      }

      // MCC/MNC
      if (/mccmnc|MCC.*MNC|operator_numeric/i.test(t) && !result.mccmnc) {
        const v = t.split(/[=:]/)[1]?.trim();
        if (v) result.mccmnc = v;
      }

      // ISO country
      if (/iso.*country|country.*iso/i.test(t) && !result.isoCountry) {
        const v = t.split(/[=:]/)[1]?.trim();
        if (v) result.isoCountry = v;
      }

      // call_screening_app — collect ALL lines (multi-profile)
      if (/call_screening_app/i.test(t)) {
        const sepIdx = Math.max(t.indexOf(":"), t.indexOf("="));
        if (sepIdx !== -1) {
          const v = t.slice(sepIdx + 1).trim();
          if (v) result.callScreeningValues.push(v);
        }
      }

      // call_redirection_service_component_name_string
      if (/call_redirection/i.test(t)) {
        const sepIdx = Math.max(t.indexOf(":"), t.indexOf("="));
        if (sepIdx !== -1) {
          const v = t.slice(sepIdx + 1).trim();
          if (v) result.callRedirectionValues.push(v);
        }
      }

      // carrier_certificate_string_array — collect ALL lines
      if (/carrier_certificate|certificate.*array/i.test(t)) {
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

      // CarrierConfig APK path
      if (/carrierconfig.*\.apk|\.apk.*carrierconfig/i.test(t) && !result.carrierConfigApk) {
        const v = t.split(/[=:]/)[1]?.trim();
        if (v) result.carrierConfigApk = v;
      }
    }

    result.detectedCertificates = Array.from(new Set(result.detectedCertificates));
  }

  // ── Section [6] — Developer Mode and ADB Status ─────────────────────────────
  const sec6 = extractSection(rawLog, 6);
  if (sec6) {
    const lines = sec6.split("\n");
    const devMode = extractProp(lines,
      "development_settings_enabled",
      "developer_mode",
      "developer.mode",
    );
    if (devMode !== null) result.developerMode = devMode;

    const adb = extractProp(lines,
      "adb_enabled",
      "usb_debugging",
      "usb.debug",
    );
    if (adb !== null) result.usbDebugging = adb;

    // Fallback line scan
    if (!result.developerMode || !result.usbDebugging) {
      for (const line of lines) {
        const t = line.trim();
        if (!result.developerMode && /developer|development_settings/i.test(t)) {
          const v = t.split(/[=:]/)[1]?.trim();
          if (v !== undefined) result.developerMode = v;
        }
        if (!result.usbDebugging && /adb_enabled|usb.debug/i.test(t)) {
          const v = t.split(/[=:]/)[1]?.trim();
          if (v !== undefined) result.usbDebugging = v;
        }
      }
    }
  }

  // ── Section [7] — Carrier ID ─────────────────────────────────────────────────
  const sec7 = extractSection(rawLog, 7);
  if (sec7) {
    const lines = sec7.split("\n");
    for (const line of lines) {
      const t = line.trim();
      if (/carrier.id|activeCarrier|active_carrier/i.test(t)) {
        const v = t.split(/[=:]/)[1]?.trim();
        if (v && !result.activeCarrierCheck) result.activeCarrierCheck = v;
      }
    }
  }

  return result;
}
