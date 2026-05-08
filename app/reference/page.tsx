"use client";

import { useEffect, useState } from "react";
import FileUpload from "@/components/FileUpload";
import ReferenceCard from "@/components/ReferenceCard";
import { ReferenceDevice } from "@/types";

export default function ReferencePage() {
  const [current, setCurrent] = useState<ReferenceDevice | null>(null);
  const [history, setHistory] = useState<ReferenceDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [refRes, histRes] = await Promise.all([
        fetch("/api/reference"),
        fetch("/api/reference/history"),
      ]);
      const refData = await refRes.json();
      const histData = await histRes.json();
      setCurrent(refData.reference ?? null);
      setHistory(histData.history ?? []);
    } catch {
      setCurrent(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    setSuccess(false);

    const form = new FormData();
    form.append("log", file);

    try {
      const res = await fetch("/api/reference", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to upload reference");
        return;
      }

      setCurrent(data.reference);
      setHistory((prev) => (data.previous ? [data.previous, ...prev] : prev));
      setSuccess(true);
      setShowUpload(false);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-20 text-gray-600 text-sm">Loading reference data…</div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Reference Device</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage the golden reference device used for DLC 2.0 compliance comparison
        </p>
      </div>

      {success && (
        <div className="bg-green-950/30 border border-green-700 rounded-lg p-4">
          <p className="text-sm text-green-400">Reference device updated successfully.</p>
        </div>
      )}

      {error && (
        <div className="bg-red-950/30 border border-red-700 rounded-lg p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Current reference */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Current Reference</h2>
          <button
            onClick={() => setShowUpload((p) => !p)}
            className="text-xs px-3 py-1.5 border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-200 rounded transition-colors"
          >
            {showUpload ? "Cancel" : current ? "Replace Reference" : "Upload Reference"}
          </button>
        </div>

        <ReferenceCard reference={current} />
      </div>

      {/* Upload area */}
      {showUpload && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-200">Upload New Reference Log</h3>
          <p className="text-xs text-gray-500">
            Upload the verification log from your golden unit (known-good, fully compliant device).
            The current reference will be archived.
          </p>
          <FileUpload
            onFile={handleFile}
            loading={uploading}
            label="Drop reference device log (.txt) here or click to select"
          />
        </div>
      )}

      {/* Reference details */}
      {current && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-200">Reference Details</h3>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            {[
              ["Model", current.model],
              ["Manufacturer", current.manufacturer],
              ["Serial", current.serial],
              ["Android", current.androidVersion],
              ["SDK", current.sdkVersion],
              ["Uploaded", new Date(current.uploadedAt).toLocaleString()],
            ].map(([k, v]) => (
              <div key={k} className="bg-gray-950 rounded p-2">
                <p className="text-gray-600 mb-0.5">{k}</p>
                <p className="font-mono text-gray-300 break-all">{v}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-2">DLC 2.0 Status on Reference</p>
            <div className="space-y-1">
              {[
                ["GlobalParametersService", current.hasGlobalParametersService],
                ["call_screening_app (Trustonic)", current.hasCallScreening],
                ["call_redirection (Trustonic)", current.hasCallRedirection],
                ["carrier_certificates (DLC+DPC+sitic)", current.hasCarrierCertificates],
              ].map(([label, ok]) => (
                <div key={label as string} className="flex items-center justify-between text-xs py-1 border-b border-gray-800">
                  <span className="font-mono text-gray-400">{label as string}</span>
                  <span className={ok ? "text-green-400" : "text-red-400"}>
                    {ok ? "Present" : "Missing"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {current.certificates.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Detected Certificates</p>
              <div className="space-y-1">
                {current.certificates.map((c) => (
                  <p key={c} className="text-xs font-mono text-gray-400 bg-gray-950 rounded px-2 py-1">{c}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reference history */}
      {history.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Previous References</h2>
          <div className="space-y-2">
            {history.map((ref, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-mono text-gray-300">{ref.model}</p>
                  <p className="text-xs text-gray-500">
                    {ref.manufacturer} • Android {ref.androidVersion} • Uploaded {new Date(ref.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-xs text-gray-600">Archived</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
