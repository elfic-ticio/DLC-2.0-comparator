"use client";

import { useEffect, useRef, useState } from "react";
import FileUpload from "@/components/FileUpload";
import CriterionCard from "@/components/CriterionCard";
import DeviceInfoCard from "@/components/DeviceInfoCard";
import BugReport from "@/components/BugReport";
import ReferenceCard from "@/components/ReferenceCard";
import { ReferenceDevice, VerificationResult } from "@/types";

export default function VerifyPage() {
  const [reference, setReference] = useState<ReferenceDevice | null>(null);
  const [loadingRef, setLoadingRef] = useState(true);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRefUpload, setShowRefUpload] = useState(false);
  const [uploadingRef, setUploadingRef] = useState(false);
  const [showBugReport, setShowBugReport] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchReference();
  }, []);

  async function fetchReference() {
    setLoadingRef(true);
    try {
      const res = await fetch("/api/reference");
      const data = await res.json();
      setReference(data.reference ?? null);
    } catch {
      setReference(null);
    } finally {
      setLoadingRef(false);
    }
  }

  async function handleVerifyFile(file: File) {
    if (!reference) {
      setShowRefUpload(true);
      return;
    }
    setVerifying(true);
    setError(null);
    setResult(null);
    setShowBugReport(false);

    const form = new FormData();
    form.append("log", file);

    try {
      const res = await fetch("/api/verify", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Verification failed");
        return;
      }

      setResult(data.result);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setVerifying(false);
    }
  }

  async function handleReferenceFile(file: File) {
    setUploadingRef(true);
    const form = new FormData();
    form.append("log", file);

    try {
      const res = await fetch("/api/reference", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to upload reference");
        return;
      }

      setReference(data.reference);
      setShowRefUpload(false);
    } catch {
      setError("Failed to upload reference log.");
    } finally {
      setUploadingRef(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-100">DLC 2.0 Verification Tool</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload a device verification log to check DLC 2.0 compliance
        </p>
      </div>

      {/* Reference status */}
      {!loadingRef && (
        <ReferenceCard
          reference={reference}
          onUploadClick={() => setShowRefUpload((p) => !p)}
        />
      )}

      {/* Reference upload panel */}
      {showRefUpload && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-200">Upload Reference Log</h2>
            <button
              onClick={() => setShowRefUpload(false)}
              className="text-xs text-gray-500 hover:text-gray-300"
            >
              Cancel
            </button>
          </div>
          <p className="text-xs text-gray-500">
            The reference log should be from a known-good, fully compliant device (e.g., your golden unit).
          </p>
          <FileUpload
            onFile={handleReferenceFile}
            loading={uploadingRef}
            label="Drop reference device log (.txt) here or click to select"
          />
        </div>
      )}

      {/* Main verification upload */}
      {!showRefUpload && (
        <div>
          <FileUpload
            onFile={handleVerifyFile}
            loading={verifying}
            label={
              reference
                ? "Drop device log file (.txt) here or click to select"
                : "Upload a reference device first"
            }
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-950/30 border border-red-700 rounded-lg p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div ref={resultRef} className="space-y-5">
          {/* Verdict banner */}
          <div
            className={`rounded-xl border p-5 text-center ${
              result.overallPass
                ? "border-green-600 bg-green-950/30"
                : "border-red-600 bg-red-950/30"
            }`}
          >
            <p
              className={`text-3xl font-bold tracking-widest ${
                result.overallPass ? "text-green-400" : "text-red-400"
              }`}
            >
              {result.overallPass ? "PASS" : "FAIL"}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {result.overallPass
                ? "Device meets all DLC 2.0 compliance criteria"
                : "One or more DLC 2.0 criteria not met"}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Device info */}
            <DeviceInfoCard device={result.device} />

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div className="bg-yellow-950/30 border border-yellow-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-yellow-400 mb-2">Warnings</h3>
                <ul className="space-y-1.5">
                  {result.warnings.map((w, i) => (
                    <li key={i} className="text-xs text-yellow-300 flex gap-2">
                      <span className="mt-0.5 shrink-0">&#9888;</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Criteria */}
          <div>
            <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">
              DLC 2.0 Criteria
            </h2>
            <div className="space-y-2">
              <CriterionCard
                title="GlobalParametersService"
                subtitle="com.google.android.devicelockcontroller — Section [4]"
                result={result.criteria.globalParametersService}
              />
              <CriterionCard
                title="call_screening_app"
                subtitle="CarrierConfig — Section [5]"
                result={result.criteria.callScreening}
              />
              <CriterionCard
                title="call_redirection_service_component_name_string"
                subtitle="CarrierConfig — Section [5]"
                result={result.criteria.callRedirection}
              />
              <CriterionCard
                title="carrier_certificate_string_array"
                subtitle="DLC + DPC + co.sitic.pp — Section [5]"
                result={result.criteria.carrierCertificates}
              />
            </div>
          </div>

          {/* Bug report */}
          {!result.overallPass && (
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-200">Bug Report</h2>
                <button
                  onClick={() => setShowBugReport((p) => !p)}
                  className="text-xs px-3 py-1.5 border border-gray-600 text-gray-400 hover:border-gray-400 rounded transition-colors"
                >
                  {showBugReport ? "Hide" : "Generate Bug Report"}
                </button>
              </div>
              {showBugReport && <BugReport result={result} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
