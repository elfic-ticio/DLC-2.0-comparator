import { ParsedLog, ReferenceDevice, VerificationResult, CriterionResult } from "@/types";

const EXPECTED_GPS = "com.google.android.devicelockcontroller/...storage.GlobalParametersService";
const EXPECTED_SCREENING = "com.trustonic.telecoms.standard.dlc/com.trustonic.telecoms.entrypoint.carrier.CallScreeningService";
const EXPECTED_REDIRECTION = "com.trustonic.telecoms.standard.dlc/com.trustonic.telecoms.entrypoint.carrier.CallRedirectionService";
const EXPECTED_CERTS = [
  "com.trustonic.telecoms.standard.dlc",
  "com.trustonic.telecoms.standard.dpc",
  "co.sitic.pp",
];

function checkGlobalParametersService(device: ParsedLog): CriterionResult {
  const pass = device.hasGlobalParametersService;
  const found = pass
    ? device.services.find(
        (s) =>
          s.includes("GlobalParametersService") &&
          s.includes("com.google.android.devicelockcontroller")
      ) ?? "com.google.android.devicelockcontroller/.GlobalParametersService"
    : null;

  return { pass, found, expected: EXPECTED_GPS };
}

function checkCallScreening(device: ParsedLog): CriterionResult {
  const TARGET = "com.trustonic.telecoms.standard.dlc";
  const TARGET_SERVICE = "CallScreeningService";

  const matchingLine = device.callScreeningValues.find(
    (v) => v.includes(TARGET) && v.includes(TARGET_SERVICE)
  );

  const pass = !!matchingLine;

  return {
    pass,
    found: matchingLine ?? (device.callScreeningValues[0] || null),
    expected: EXPECTED_SCREENING,
  };
}

function checkCallRedirection(device: ParsedLog): CriterionResult {
  const TARGET = "com.trustonic.telecoms.standard.dlc";
  const TARGET_SERVICE = "CallRedirectionService";

  const matchingLine = device.callRedirectionValues.find(
    (v) => v.includes(TARGET) && v.includes(TARGET_SERVICE)
  );

  const pass = !!matchingLine;

  return {
    pass,
    found: matchingLine ?? (device.callRedirectionValues[0] || null),
    expected: EXPECTED_REDIRECTION,
  };
}

function checkCarrierCertificates(device: ParsedLog): CriterionResult {
  const certs = device.detectedCertificates;
  const hasDlc = certs.some((c) => c.includes("com.trustonic.telecoms.standard.dlc"));
  const hasDpc = certs.some((c) => c.includes("com.trustonic.telecoms.standard.dpc"));
  const hasSitic = certs.some((c) => c.includes("co.sitic.pp"));

  const pass = hasDlc && hasDpc && hasSitic;

  return {
    pass,
    found: certs.length > 0 ? certs : null,
    expected: EXPECTED_CERTS,
  };
}

export function compare(device: ParsedLog, reference: ReferenceDevice): VerificationResult {
  const warnings: string[] = [];

  if (device.simState === "ABSENT" || device.simState === "absent") {
    warnings.push(
      "SIM card is ABSENT. CarrierConfig parameters may be empty. Retest with SIM inserted."
    );
  }

  if (device.avbState && device.avbState !== "green") {
    warnings.push(`AVB state is "${device.avbState}" (expected: green).`);
  }

  if (device.bootloaderStatus === "0") {
    warnings.push("Bootloader is UNLOCKED (expected: locked / status=1).");
  }

  if (device.buildType && device.buildType !== "user") {
    warnings.push(`Build type is "${device.buildType}" (expected: user). This is not a production build.`);
  }

  if (device.developerMode === "1") {
    warnings.push("Developer mode is ENABLED. Should be disabled on production devices.");
  }

  if (device.usbDebugging === "1") {
    warnings.push("USB Debugging is ENABLED. Should be disabled on production devices.");
  }

  const criteria = {
    globalParametersService: checkGlobalParametersService(device),
    callScreening: checkCallScreening(device),
    callRedirection: checkCallRedirection(device),
    carrierCertificates: checkCarrierCertificates(device),
  };

  const overallPass = Object.values(criteria).every((c) => c.pass);

  return {
    device,
    reference,
    criteria,
    warnings,
    overallPass,
    timestamp: new Date().toISOString(),
  };
}
