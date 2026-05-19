import { useEffect, useRef, useState } from "react";

interface Props {
  /** Max recording length in seconds (default 60). */
  maxSeconds?: number;
  onComplete: (blob: Blob, mimeType: string) => void;
  disabled?: boolean;
}

const PREFERRED_MIME = "audio/webm;codecs=opus";

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  if (MediaRecorder.isTypeSupported(PREFERRED_MIME)) return PREFERRED_MIME;
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  return "";
}

export function MicRecorder({
  maxSeconds = 60,
  onComplete,
  disabled,
}: Props) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => () => {
      timerRef.current && clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  async function start() {
    setError(null);
    chunksRef.current = [];
    setSeconds(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      streamRef.current = stream;
      const mime = pickMimeType();
      const rec = new MediaRecorder(
        stream,
        mime ? { mimeType: mime } : undefined,
      );
      recorderRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const used = rec.mimeType || mime || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: used });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        onComplete(blob, used);
      };
      rec.start();
      setIsRecording(true);
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          const next = s + 1;
          if (next >= maxSeconds) stop();
          return next;
        });
      }, 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "microphone unavailable");
    }
  }

  function stop() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    setIsRecording(false);
  }

  return (
    <div className="space-y-2" data-testid="mic-recorder">
      <div className="flex items-center gap-3">
        <button
          type="button"
          data-testid={isRecording ? "mic-stop" : "mic-start"}
          disabled={disabled}
          onClick={isRecording ? stop : start}
          className="px-3 py-1.5 rounded-md border border-glass-soft text-warm text-[11px] font-mono tracking-[0.18em] uppercase disabled:opacity-40"
        >
          {isRecording ? "Stop" : "Record"}
        </button>
        <span className="text-[12px] text-silver">
          {seconds.toString().padStart(2, "0")}s / {maxSeconds}s
        </span>
      </div>
      {error && (
        <div role="alert" className="text-[11px] text-rose-300">
          {error}
        </div>
      )}
    </div>
  );
}
