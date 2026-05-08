import { VerificationResult } from "@/types";

export function generateBugTemplate(result: VerificationResult): string {
  const { device, reference, criteria, warnings } = result;

  const model = device.model ?? "Unknown Model";
  const serial = device.serial ?? "N/A";
  const android = device.androidVersion ?? "N/A";
  const sdk = device.sdkVersion ?? "N/A";
  const refModel = reference.model ?? "Reference Device";

  const simAbsent =
    device.simState === "ABSENT" || device.simState === "absent";

  const simInfo = simAbsent
    ? "with no SIM inserted"
    : device.mccmnc
    ? "with SIM (MCC/MNC: " + device.mccmnc + ")"
    : "with SIM inserted";

  const gpsFound = criteria.globalParametersService.found;
  const gpsStatus = criteria.globalParametersService.pass
    ? "1. GlobalParametersService: OK — service is present and active."
    : "1. GlobalParametersService: FAIL — service NOT found in Activity Manager." +
      " Expected: com.google.android.devicelockcontroller/...GlobalParametersService." +
      (gpsFound ? " Found: " + String(gpsFound) + "." : " Found: nothing.");

  const screeningFound = criteria.callScreening.found;
  const screeningStatus = criteria.callScreening.pass
    ? "2. call_screening_app: OK — correct Trustonic value present."
    : "2. call_screening_app: FAIL — incorrect or missing value." +
      " Expected: com.trustonic.telecoms.standard.dlc/com.trustonic.telecoms.entrypoint.carrier.CallScreeningService." +
      (screeningFound ? " Found: " + String(screeningFound) + "." : " Found: empty or null.");

  const redirectionFound = criteria.callRedirection.found;
  const redirectionStatus = criteria.callRedirection.pass
    ? "3. call_redirection_service_component_name_string: OK."
    : "3. call_redirection_service_component_name_string: FAIL." +
      " Expected: com.trustonic.telecoms.standard.dlc/com.trustonic.telecoms.entrypoint.carrier.CallRedirectionService." +
      (redirectionFound ? " Found: " + String(redirectionFound) + "." : " Found: empty or null.");

  const certsFound = Array.isArray(criteria.carrierCertificates.found)
    ? criteria.carrierCertificates.found.join(", ")
    : criteria.carrierCertificates.found ?? "none";

  const certStatus = criteria.carrierCertificates.pass
    ? "4. carrier_certificate_string_array: OK — DLC, DPC, and co.sitic.pp certificates detected."
    : "4. carrier_certificate_string_array: FAIL — missing required certificates." +
      " Expected certificates for: com.trustonic.telecoms.standard.dlc," +
      " com.trustonic.telecoms.standard.dpc, and co.sitic.pp." +
      (certsFound !== "none" ? " Found: " + certsFound + "." : " Found: none.");

  const fixes: string[] = [];
  if (!criteria.globalParametersService.pass) {
    fixes.push(
      "ensure the GlobalParametersService from com.google.android.devicelockcontroller is active in Activity Manager"
    );
  }
  if (!criteria.callScreening.pass) {
    fixes.push(
      "set call_screening_app in CarrierConfig to com.trustonic.telecoms.standard.dlc/com.trustonic.telecoms.entrypoint.carrier.CallScreeningService"
    );
  }
  if (!criteria.callRedirection.pass) {
    fixes.push(
      "set call_redirection_service_component_name_string to com.trustonic.telecoms.standard.dlc/com.trustonic.telecoms.entrypoint.carrier.CallRedirectionService"
    );
  }
  if (!criteria.carrierCertificates.pass) {
    fixes.push(
      "populate carrier_certificate_string_array with the SHA1/SHA256 certificates for DLC, DPC, and co.sitic.pp"
    );
  }

  const oemFix = fixes.length > 0
    ? "The OEM must " + fixes.join("; and ") + "."
    : "";

  const simNote = simAbsent
    ? "\n> SIM was ABSENT during this verification. Some CarrierConfig values may be empty." +
      " Retesting with an active SIM (MCC/MNC 73210x) is recommended to confirm CarrierConfig criteria."
    : "";

  const template =
    "【Expect result】\n" +
    model + " (Android " + android + ", SDK " + sdk + ") must comply with DLC 2.0 integration equivalent to the reference model " + refModel + ":\n" +
    "1. The GlobalParametersService from DLC controller (com.google.android.devicelockcontroller) must be active and running in Activity Manager.\n" +
    "2. The call_screening_app parameter in CarrierConfig must point to com.trustonic.telecoms.standard.dlc/com.trustonic.telecoms.entrypoint.carrier.CallScreeningService.\n" +
    "3. The call_redirection_service_component_name_string must point to com.trustonic.telecoms.standard.dlc/com.trustonic.telecoms.entrypoint.carrier.CallRedirectionService.\n" +
    "4. The carrier_certificate_string_array must contain the SHA1/SHA256 certificates for DLC, DPC, and co.sitic.pp.\n" +
    "\n" +
    "【Test result】\n" +
    "On " + model + " (S/N: " + serial + ", Android " + android + ", SDK " + sdk + "), " + simInfo + ", the following was found:\n" +
    gpsStatus + "\n" +
    screeningStatus + "\n" +
    redirectionStatus + "\n" +
    certStatus + "\n" +
    simNote + "\n" +
    "> " + oemFix;

  return template.trim();
}
