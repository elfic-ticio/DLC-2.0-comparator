"use client";

import { useState } from "react";
import { CriterionResult } from "@/types";

interface CriterionCardProps {
  title: string;
  subtitle?: string;
  result: CriterionResult;
}

export default function CriterionCard({ title, subtitle, result }: CriterionCardProps) {
  const [expanded, setExpanded] = useState(!result.pass);

  const passColor = result.pass
    ? "border-green-700 bg-green-950/30"
    : "border-red-700 bg-red-950/30";

  const badgeColor = result.pass
    ? "bg-green-500/20 text-green-400 border border-green-700"
    : "bg-red-500/20 text-red-400 border border-red-700";

  const foundVal = Array.isArray(result.found)
    ? result.found.join("\n")
    : result.found ?? "(none)";

  const expectedVal = Array.isArray(result.expected)
    ? result.expected.join("\n")
    : result.expected;

  return (
    <div className={`rounded-lg border ${passColor} overflow-hidden`}>
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`text-xs font-mono px-2 py-0.5 rounded ${badgeColor}`}>
            {result.pass ? "PASS" : "FAIL"}
          </span>
          <div>
            <p className="text-sm font-medium text-gray-200">{title}</p>
            {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
          </div>
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`w-4 h-4 text-gray-500 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-800">
          <div className="mt-3">
            <p className="text-xs text-gray-500 mb-1">Found</p>
            <pre className="text-xs font-mono bg-gray-900 rounded p-2 text-gray-300 whitespace-pre-wrap break-all">
              {foundVal}
            </pre>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Expected</p>
            <pre className="text-xs font-mono bg-gray-900 rounded p-2 text-gray-400 whitespace-pre-wrap break-all">
              {expectedVal}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
