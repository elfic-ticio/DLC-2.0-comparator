import { ParsedLog } from "@/types";

interface DeviceInfoCardProps {
  device: ParsedLog;
}

function Row({ label, value, mono = false }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-800 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs ${mono ? "font-mono" : ""} text-gray-300`}>
        {value ?? <span className="text-gray-600">N/A</span>}
      </span>
    </div>
  );
}

export default function DeviceInfoCard({ device }: DeviceInfoCardProps) {
  const simBadge =
    device.simState === "LOADED"
      ? "bg-green-900/40 text-green-400 border border-green-700"
      : device.simState === "ABSENT"
      ? "bg-yellow-900/40 text-yellow-400 border border-yellow-700"
      : "bg-gray-800 text-gray-400 border border-gray-700";

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-200">Device Info</h3>
        <span className={`text-xs px-2 py-0.5 rounded font-mono ${simBadge}`}>
          SIM: {device.simState ?? "N/A"}
        </span>
      </div>
      <div className="space-y-0">
        <Row label="Manufacturer" value={device.manufacturer} />
        <Row label="Model" value={device.model} />
        <Row label="Serial" value={device.serial} mono />
        <Row label="Android" value={device.androidVersion} />
        <Row label="SDK" value={device.sdkVersion} />
        <Row label="Build Type" value={device.buildType} />
        <Row label="AVB State" value={device.avbState} />
        <Row label="Bootloader" value={device.bootloaderStatus === "1" ? "Locked (1)" : device.bootloaderStatus === "0" ? "Unlocked (0)" : device.bootloaderStatus} />
        <Row label="MCC/MNC" value={device.mccmnc} mono />
        <Row label="ISO Country" value={device.isoCountry} />
      </div>
    </div>
  );
}
