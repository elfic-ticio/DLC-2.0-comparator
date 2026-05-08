// Quick parser smoke-test against the real log format
const log = `================================================
VERIFICATION DLC / CARRIERCONFIG / SECURITY
Fecha de ejecucion: Mon 01/19/2026
================================================

[0] CONNECTED DEVICE
List of devices attached
154863756Y000173\tdevice


=========================================================================================
[1] ANDROID VERSION / MANUFACTURER / MODEL

MANUFACTURER:
TECNO
MODEL:
TECNO KM8n
ANDROID VERSION:
15
SDK VERSION:
35
SECURITY BUILD TYPE USER-ENG-USERDEBUG:
user

=========================================================================================
[2] VERIFIED BOOT Y BOOTLOADER

ANDROID VERIFIED BOOT - AVB AUTHENTIC ROM:
green

BOOTLOADER STATUS:
1

=========================================================================================
[3] DLC PACKAGES / TRUSTONIC

package:com.google.android.devicelockcontroller
package:com.android.carrierconfig

=========================================================================================
[4] DLC SERVICES IN ACTIVITY MANAGER

  * ServiceRecord{d908d27 u0 com.google.android.devicelockcontroller/com.android.devicelockcontroller.storage.GlobalParametersService c:com.google.android.devicelockcontroller}
    intent={cmp=com.google.android.devicelockcontroller/com.android.devicelockcontroller.storage.GlobalParametersService}
  * ServiceRecord{e733cce u0 com.android.phone/com.transsion.phone.network.DeviceLockQueryService c:com.android.phone}

=========================================================================================
[5] CARRIERCONFIG - CRITICAL PARAMETERS

FILTRADO DE LLAMADAS DLC Call_Screening:
            call_screening_app =
            call_screening_app = com.trustonic.telecoms.standard.dlc/com.trustonic.telecoms.entrypoint.carrier.CallScreeningService

CALL REDIRECTION CONFIG:
            call_redirection_service_component_name_string = null
            call_redirection_service_component_name_string = com.trustonic.telecoms.standard.dlc/com.trustonic.telecoms.entrypoint.carrier.CallRedirectionService

CARRIER CERTIFICATES 1913-T:
            carrier_certificate_string_array = []
            carrier_certificate_string_array = [8C960CA3:com.trustonic.telecoms.standard.dlc,com.trustonic.telecoms.standard.dpc, 2333F4:co.sitic.pp]

[OK] Certificado DLC encontrado en carrier_certificate_string_array
[OK] Certificado DPC encontrado en carrier_certificate_string_array
[OK] Certificado co.sitic.pp encontrado en carrier_certificate_string_array

=========================================================================================
[6] DEVELOPER MODE AND ADB STATUS

DEVELOPER MODE CHECK:
1

USB DEBUGGING STATE:
1

=========================================================================================
[7] CARRIER ID

ACTIVE CARRIER CHECK:

================================================
End of verification
================================================
`;

// Inline the core logic to test without TS compilation
function extractSection(rawLog, sectionNum) {
  const markers = ["[0]","[1]","[2]","[3]","[4]","[5]","[6]","[7]"];
  const start = markers[sectionNum];
  const end = markers[sectionNum + 1] ?? null;
  const startIdx = rawLog.indexOf(start);
  if (startIdx === -1) return "";
  const endIdx = end ? rawLog.indexOf(end, startIdx + start.length) : rawLog.length;
  return rawLog.slice(startIdx, endIdx === -1 ? rawLog.length : endIdx);
}

function isNoise(line) {
  const t = line.trim();
  return !t || t.startsWith("Nota:") || t.startsWith("Solucion:") || t.startsWith("===") || t.startsWith("Ejemplo") || t.startsWith("App y");
}

function extractNextLineValue(section, labelPattern) {
  const lines = section.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
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

const sec1 = extractSection(log, 1);
const sec2 = extractSection(log, 2);
const sec6 = extractSection(log, 6);
const sec0 = extractSection(log, 0);
const sec4 = extractSection(log, 4);
const sec5 = extractSection(log, 5);

// Serial
let serial = null;
const lines0 = sec0.split("\n");
for (let i = 0; i < lines0.length; i++) {
  if (lines0[i].includes("List of devices attached")) {
    for (let j = i + 1; j < lines0.length; j++) {
      const next = lines0[j].trim();
      if (!next) continue;
      serial = next.split(/\s+/)[0];
      break;
    }
  }
}

// Certs
const detectedCerts = [];
const lines5 = sec5.split("\n");
for (const line of lines5) {
  const t = line.trim();
  if (t.includes("[OK]") && /dlc/i.test(t)) detectedCerts.push("dlc");
  if (t.includes("[OK]") && /dpc/i.test(t)) detectedCerts.push("dpc");
  if (t.includes("[OK]") && /sitic/i.test(t)) detectedCerts.push("co.sitic.pp");
}

const callScreening = [];
for (const line of lines5) {
  const t = line.trim();
  if (/^call_screening_app\s*=/i.test(t)) {
    const v = t.slice(t.indexOf("=") + 1).trim();
    if (v) callScreening.push(v);
  }
}

console.log("=== PARSER TEST ===");
console.log("serial         :", serial);
console.log("manufacturer   :", extractNextLineValue(sec1, /MANUFACTURER/i));
console.log("model          :", extractNextLineValue(sec1, /^MODEL\s*:/i));
console.log("androidVersion :", extractNextLineValue(sec1, /ANDROID VERSION/i));
console.log("sdkVersion     :", extractNextLineValue(sec1, /SDK VERSION/i));
console.log("buildType      :", extractNextLineValue(sec1, /BUILD TYPE/i));
console.log("avbState       :", extractNextLineValue(sec2, /AVB|VERIFIED BOOT/i));
console.log("bootloader     :", extractNextLineValue(sec2, /BOOTLOADER STATUS/i));
console.log("developerMode  :", extractNextLineValue(sec6, /DEVELOPER MODE/i));
console.log("usbDebugging   :", extractNextLineValue(sec6, /USB DEBUGGING/i));
console.log("globalParamSvc :", sec4.includes("GlobalParametersService") && sec4.includes("com.google.android.devicelockcontroller"));
console.log("callScreening  :", callScreening);
console.log("certs          :", detectedCerts);
