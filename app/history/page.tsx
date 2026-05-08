"use client";

import { useEffect, useState, useCallback } from "react";
import { StoredVerification } from "@/types";

interface Stats {
  total: number;
  passed: number;
  failed: number;
  models: string[];
}

function PassBadge({ pass }: { pass: boolean }) {
  return (
    <span
      className={`inline-block text-xs px-2 py-0.5 rounded font-mono border ${
        pass
          ? "border-green-700 bg-green-900/30 text-green-400"
          : "border-red-700 bg-red-900/30 text-red-400"
      }`}
    >
      {pass ? "PASS" : "FAIL"}
    </span>
  );
}

interface DetailModalProps {
  v: StoredVerification;
  onClose: () => void;
}

function DetailModal({ v, onClose }: DetailModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div>
            <h2 className="text-sm font-semibold text-gray-200 font-mono">{v.model}</h2>
            <p className="text-xs text-gray-500">{new Date(v.date).toLocaleString()}</p>
          </div>
          <div className="flex items-center gap-3">
            <PassBadge pass={v.overallPass} />
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl leading-none">&times;</button>
          </div>
        </div>
        <div className="p-5 space-y-5">
          {/* Device Info */}
          <section>
            <h3 className="text-xs uppercase text-gray-500 tracking-wider mb-2">Device</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ["Serial", v.serial],
                ["Manufacturer", v.manufacturer],
                ["Android", v.androidVersion],
                ["SDK", v.sdkVersion],
                ["SIM State", v.simState],
                ["MCC/MNC", v.mccmnc],
                ["AVB State", v.avbState],
                ["Bootloader", v.bootloaderStatus],
                ["Reference", v.referenceModel],
              ].map(([k, val]) => (
                <div key={k} className="bg-gray-950 rounded p-2">
                  <p className="text-gray-600">{k}</p>
                  <p className="font-mono text-gray-300">{val || "N/A"}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Criteria */}
          <section>
            <h3 className="text-xs uppercase text-gray-500 tracking-wider mb-2">Criteria</h3>
            <div className="space-y-1">
              {[
                ["GlobalParametersService", v.results.globalParametersService],
                ["call_screening_app", v.results.callScreening],
                ["call_redirection", v.results.callRedirection],
                ["carrier_certificates", v.results.carrierCertificates],
              ].map(([label, pass]) => (
                <div key={label as string} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-800">
                  <span className="font-mono text-gray-400">{label as string}</span>
                  <PassBadge pass={pass as boolean} />
                </div>
              ))}
            </div>
          </section>

          {/* Warnings */}
          {v.warnings.length > 0 && (
            <section>
              <h3 className="text-xs uppercase text-gray-500 tracking-wider mb-2">Warnings</h3>
              <ul className="space-y-1">
                {v.warnings.map((w, i) => (
                  <li key={i} className="text-xs text-yellow-400 flex gap-2">
                    <span>&#9888;</span><span>{w}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const [verifications, setVerifications] = useState<StoredVerification[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [modelFilter, setModelFilter] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const [selected, setSelected] = useState<StoredVerification | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (modelFilter) params.set("model", modelFilter);
      if (resultFilter) params.set("result", resultFilter);
      params.set("limit", "100");

      const [histRes, statsRes] = await Promise.all([
        fetch(`/api/history?${params}`),
        fetch("/api/stats"),
      ]);

      const histData = await histRes.json();
      const statsData = await statsRes.json();

      setVerifications(histData.verifications ?? []);
      setStats(statsData);
    } catch {
      setVerifications([]);
    } finally {
      setLoading(false);
    }
  }, [modelFilter, resultFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this verification?")) return;
    setDeleting(id);
    try {
      await fetch(`/api/history/${encodeURIComponent(id)}`, { method: "DELETE" });
      setVerifications((prev) => prev.filter((v) => v.id !== id));
      if (selected?.id === id) setSelected(null);
    } finally {
      setDeleting(null);
    }
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(verifications, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dlc-history-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const passRate =
    stats && stats.total > 0
      ? Math.round((stats.passed / stats.total) * 100)
      : null;

  return (
    <div className="space-y-6">
      {selected && <DetailModal v={selected} onClose={() => setSelected(null)} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Verification History</h1>
          <p className="text-sm text-gray-500 mt-1">All past DLC 2.0 verification records</p>
        </div>
        <button
          onClick={exportJSON}
          disabled={verifications.length === 0}
          className="text-xs px-3 py-1.5 border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-200 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Export JSON
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total", value: stats.total, color: "text-gray-200" },
            { label: "Passed", value: stats.passed, color: "text-green-400" },
            { label: "Failed", value: stats.failed, color: "text-red-400" },
            { label: "Pass Rate", value: passRate !== null ? `${passRate}%` : "—", color: passRate !== null && passRate >= 80 ? "text-green-400" : "text-yellow-400" },
          ].map((s) => (
            <div key={s.label} className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={modelFilter}
          onChange={(e) => setModelFilter(e.target.value)}
          className="text-sm bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-gray-300 focus:outline-none focus:border-gray-500"
        >
          <option value="">All Models</option>
          {stats?.models.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select
          value={resultFilter}
          onChange={(e) => setResultFilter(e.target.value)}
          className="text-sm bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-gray-300 focus:outline-none focus:border-gray-500"
        >
          <option value="">All Results</option>
          <option value="PASS">PASS</option>
          <option value="FAIL">FAIL</option>
        </select>
        <button
          onClick={fetchData}
          className="text-sm px-3 py-1.5 border border-gray-700 text-gray-400 rounded hover:border-gray-500 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-600 text-sm">Loading…</div>
      ) : verifications.length === 0 ? (
        <div className="text-center py-12 text-gray-600 text-sm">
          No verifications found. Run a verification on the main page.
        </div>
      ) : (
        <div className="border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/60">
                <th className="text-left text-xs text-gray-500 font-normal px-4 py-2.5">Date</th>
                <th className="text-left text-xs text-gray-500 font-normal px-4 py-2.5">Model</th>
                <th className="text-left text-xs text-gray-500 font-normal px-4 py-2.5 hidden md:table-cell">Serial</th>
                <th className="text-left text-xs text-gray-500 font-normal px-4 py-2.5 hidden md:table-cell">SIM</th>
                <th className="text-left text-xs text-gray-500 font-normal px-4 py-2.5">Result</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {verifications.map((v) => (
                <tr
                  key={v.id}
                  className="border-b border-gray-800 last:border-0 hover:bg-gray-900/40 cursor-pointer"
                  onClick={() => setSelected(v)}
                >
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(v.date).toLocaleDateString()} {new Date(v.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-300">{v.model}</td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-500 hidden md:table-cell">{v.serial}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">{v.simState}</td>
                  <td className="px-4 py-3">
                    <PassBadge pass={v.overallPass} />
                  </td>
                  <td
                    className="px-4 py-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => handleDelete(v.id)}
                      disabled={deleting === v.id}
                      className="text-xs text-gray-600 hover:text-red-400 transition-colors disabled:opacity-30"
                    >
                      {deleting === v.id ? "…" : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
