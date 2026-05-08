export interface ParsedLog {
  // Section [0]
  serial: string | null;

  // Section [1]
  manufacturer: string | null;
  model: string | null;
  androidVersion: string | null;
  sdkVersion: string | null;
  buildType: string | null;

  // Section [2]
  avbState: string | null;
  bootloaderStatus: string | null;

  // Section [3]
  dlcPackages: string[];
  apexModules: string[];

  // Section [4]
  services: string[];
  hasGlobalParametersService: boolean;
  hasSetupParametersService: boolean;
  hasDeviceLockQueryService: boolean;
  hasDeviceLockFirebaseService: boolean;

  // Section [5]
  simState: string | null;
  mccmnc: string | null;
  isoCountry: string | null;
  callScreeningValues: string[];
  callRedirectionValues: string[];
  carrierCertificateLines: string[];
  detectedCertificates: string[];
  carrierConfigApk: string | null;

  // Section [6]
  developerMode: string | null;
  usbDebugging: string | null;

  // Section [7]
  activeCarrierCheck: string | null;

  // Meta
  isValid: boolean;
  invalidReason: string | null;
  rawLog: string;
}

export interface ReferenceDevice {
  model: string;
  serial: string;
  manufacturer: string;
  androidVersion: string;
  sdkVersion: string;
  uploadedAt: string;
  services: string[];
  hasGlobalParametersService: boolean;
  hasCallScreening: boolean;
  callScreeningValue: string;
  hasCallRedirection: boolean;
  callRedirectionValue: string;
  hasCarrierCertificates: boolean;
  certificates: string[];
  rawLog: string;
}

export interface CriterionResult {
  pass: boolean;
  found: string | string[] | null;
  expected: string | string[];
}

export interface VerificationResult {
  device: ParsedLog;
  reference: ReferenceDevice;
  criteria: {
    globalParametersService: CriterionResult;
    callScreening: CriterionResult;
    callRedirection: CriterionResult;
    carrierCertificates: CriterionResult;
  };
  warnings: string[];
  overallPass: boolean;
  timestamp: string;
}

export interface StoredVerification {
  id: string;
  model: string;
  serial: string;
  manufacturer: string;
  androidVersion: string;
  sdkVersion: string;
  simState: string;
  mccmnc: string;
  avbState: string;
  bootloaderStatus: string;
  referenceModel: string;
  results: {
    globalParametersService: boolean;
    callScreening: boolean;
    callRedirection: boolean;
    carrierCertificates: boolean;
  };
  warnings: string[];
  overallPass: boolean;
  date: string;
  rawLog: string;
}

export interface HistoryFilter {
  model?: string;
  result?: "PASS" | "FAIL";
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}
