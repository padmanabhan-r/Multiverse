import { useEffect, useRef, useState } from "react";
import { api, type VoiceCloneJob } from "@/lib/api";

interface Props {
  jobId: string;
  /** Poll interval in ms. Default 30 s. */
  intervalMs?: number;
  onComplete?: (job: VoiceCloneJob) => void;
}

const TERMINAL: VoiceCloneJob["status"][] = ["fine_tuned", "failed"];

export function CloneJobStatus({
  jobId,
  intervalMs = 30_000,
  onComplete,
}: Props) {
  const [job, setJob] = useState<VoiceCloneJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const next = await api.getCloneJob(jobId);
        if (cancelled) return;
        setJob(next);
        if (TERMINAL.includes(next.status)) {
          if (timerRef.current) clearInterval(timerRef.current);
          onComplete?.(next);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "fetch failed");
        }
      }
    }

    tick();
    timerRef.current = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [jobId, intervalMs, onComplete]);

  if (error) {
    return (
      <div
        role="alert"
        data-testid="clone-job-error"
        className="text-[12px] text-rose-300 border border-rose-400/30 rounded-md p-3 bg-rose-500/10"
      >
        {error}
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-[12px] text-silver" data-testid="clone-job-loading">
        Loading…
      </div>
    );
  }

  return (
    <div
      className="space-y-2 p-3 rounded-md border border-glass-soft"
      data-testid="clone-job-status"
    >
      <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-silver">
        Status
      </div>
      <div className="text-warm" data-testid={`clone-job-status-${job.status}`}>
        {labelFor(job.status)}
      </div>
      <div className="text-[11px] text-silver">
        {job.poll_attempts} {job.poll_attempts === 1 ? "check" : "checks"} so far
        {job.refunded ? " · 50 credits refunded" : ""}
      </div>
      {job.error_message && (
        <div className="text-[11px] text-rose-300">{job.error_message}</div>
      )}
    </div>
  );
}

function labelFor(status: VoiceCloneJob["status"]): string {
  switch (status) {
    case "queued":
      return "Queued — training will start shortly";
    case "fine_tuning":
      return "Training in progress (24–72 h typical)";
    case "fine_tuned":
      return "Ready to use!";
    case "failed":
      return "Training failed — credits refunded";
  }
}
