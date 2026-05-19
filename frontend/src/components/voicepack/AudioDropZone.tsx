import { useId, useState } from "react";

interface Props {
  multiple?: boolean;
  /** Per-file max bytes. */
  maxBytes?: number;
  /** Combined max bytes across all selections. */
  totalMaxBytes?: number;
  onChange: (files: File[]) => void;
  disabled?: boolean;
}

const AUDIO_MIME = /^audio\//;

function validate(
  files: File[],
  perMax: number,
  totalMax: number,
): string | null {
  let total = 0;
  for (const f of files) {
    if (!AUDIO_MIME.test(f.type)) {
      return `${f.name} is not an audio file`;
    }
    if (f.size > perMax) {
      return `${f.name} exceeds ${Math.round(perMax / (1024 * 1024))} MB`;
    }
    total += f.size;
  }
  if (total > totalMax) {
    return `Combined files exceed ${Math.round(totalMax / (1024 * 1024))} MB`;
  }
  return null;
}

export function AudioDropZone({
  multiple = false,
  maxBytes = 25 * 1024 * 1024,
  totalMaxBytes = 50 * 1024 * 1024,
  onChange,
  disabled,
}: Props) {
  const inputId = useId();
  const [selected, setSelected] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  function handle(files: FileList | null) {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    const issue = validate(arr, maxBytes, totalMaxBytes);
    if (issue) {
      setError(issue);
      return;
    }
    setError(null);
    setSelected(arr);
    onChange(arr);
  }

  return (
    <div className="space-y-2" data-testid="audio-dropzone">
      <label
        htmlFor={inputId}
        className="
          block p-4 rounded-md border border-dashed border-glass-soft
          text-center text-[12px] text-silver cursor-pointer
          hover:border-warm/40
        "
      >
        <input
          id={inputId}
          type="file"
          accept="audio/*"
          multiple={multiple}
          disabled={disabled}
          data-testid="audio-dropzone-input"
          onChange={(e) => handle(e.target.files)}
          className="hidden"
        />
        {selected.length === 0 ? (
          <span>Click to choose audio file{multiple ? "s" : ""}</span>
        ) : (
          <span data-testid="audio-dropzone-files">
            {selected.length} file{selected.length === 1 ? "" : "s"} selected
          </span>
        )}
      </label>
      {error && (
        <div
          role="alert"
          data-testid="audio-dropzone-error"
          className="text-[11px] text-rose-300"
        >
          {error}
        </div>
      )}
    </div>
  );
}
