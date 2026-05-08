"use client";

import { useState } from "react";
import { VerificationResult } from "@/types";
import { generateBugTemplate } from "@/lib/bug-template";

interface BugReportProps {
  result: VerificationResult;
}

export default function BugReport({ result }: BugReportProps) {
  const [copied, setCopied] = useState(false);
  const template = generateBugTemplate(result);

  async function copy() {
    try {
      await navigator.clipboard.writeText(template);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const el = document.createElement("textarea");
      el.value = template;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-200">Jira Bug Report Template</h3>
        <button
          onClick={copy}
          className={`text-xs px-3 py-1.5 rounded border transition-colors ${
            copied
              ? "border-green-600 bg-green-900/30 text-green-400"
              : "border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-400"
          }`}
        >
          {copied ? "Copied!" : "Copy to clipboard"}
        </button>
      </div>
      <pre className="text-xs font-mono bg-gray-950 border border-gray-800 rounded-lg p-4 text-gray-300 whitespace-pre-wrap overflow-auto max-h-96">
        {template}
      </pre>
    </div>
  );
}
