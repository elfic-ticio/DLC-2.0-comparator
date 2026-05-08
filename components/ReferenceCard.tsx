import { ReferenceDevice } from "@/types";

interface ReferenceCardProps {
  reference: ReferenceDevice | null;
  onUploadClick?: () => void;
}

export default function ReferenceCard({ reference, onUploadClick }: ReferenceCardProps) {
  if (!reference) {
    return (
      <div className="bg-yellow-950/30 border border-yellow-700 rounded-lg p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-yellow-400">No reference device configured</p>
          <p className="text-xs text-yellow-600 mt-0.5">Upload a reference log to start verifying devices</p>
        </div>
        {onUploadClick && (
          <button
            onClick={onUploadClick}
            className="text-xs px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-black font-medium rounded transition-colors"
          >
            Upload Reference
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 flex items-center justify-between">
      <div>
        <p className="text-xs text-gray-500">Reference Device</p>
        <p className="text-sm font-medium text-gray-200 font-mono">{reference.model}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {reference.manufacturer} • Android {reference.androidVersion} • SDK {reference.sdkVersion}
        </p>
        <p className="text-xs text-gray-600 mt-0.5">
          Uploaded: {new Date(reference.uploadedAt).toLocaleString()}
        </p>
      </div>
      {onUploadClick && (
        <button
          onClick={onUploadClick}
          className="text-xs px-3 py-1.5 border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-200 rounded transition-colors"
        >
          Change
        </button>
      )}
    </div>
  );
}
