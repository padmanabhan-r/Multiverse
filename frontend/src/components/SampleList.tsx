import { useState } from "react";
import type { PackSample } from "@multiverse-fm/shared";
import { api } from "@/lib/api";

interface Props {
  packId: string;
  samples: PackSample[];
  onChange: () => void;
}

export function SampleList({ packId, samples, onChange }: Props) {
  if (samples.length === 0) {
    return (
      <div
        data-testid="sample-list-empty"
        className="text-silver text-[12px] italic py-4"
      >
        No samples yet. Generate one with the form above.
      </div>
    );
  }

  return (
    <ul data-testid="sample-list" className="space-y-2">
      {samples.map((s, idx) => (
        <SampleRow
          key={s.id}
          sample={s}
          packId={packId}
          isFirst={idx === 0}
          isLast={idx === samples.length - 1}
          onChange={onChange}
        />
      ))}
    </ul>
  );
}

interface RowProps {
  sample: PackSample;
  packId: string;
  isFirst: boolean;
  isLast: boolean;
  onChange: () => void;
}

function SampleRow({ sample, packId, isFirst, isLast, onChange }: RowProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(sample.title);

  async function move(delta: -1 | 1) {
    await api.updateSample(packId, sample.id, {
      position: sample.position + delta,
    });
    onChange();
  }

  async function save() {
    if (title.trim() !== sample.title) {
      await api.updateSample(packId, sample.id, { title: title.trim() });
      onChange();
    }
    setEditing(false);
  }

  async function remove() {
    await api.deleteSample(packId, sample.id);
    onChange();
  }

  const seconds = (sample.duration_ms / 1000).toFixed(1);

  return (
    <li
      data-testid={`sample-row-${sample.id}`}
      className="
        flex items-center gap-3 p-3 rounded-md
        bg-elev-2/40 border border-glass-soft text-[12px]
      "
    >
      <span
        className="font-mono text-[10px] text-silver2 w-6"
        data-testid="sample-position"
      >
        {sample.position + 1}.
      </span>

      <audio
        src={sample.audio_url}
        controls
        className="h-8 flex-shrink-0"
        data-testid="sample-audio"
      />

      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => e.key === "Enter" && save()}
            autoFocus
            data-testid="sample-title-input"
            className="
              w-full p-1 rounded bg-elev-2/80 border border-glass-soft
              text-warm text-[12px]
            "
          />
        ) : (
          <button
            type="button"
            data-testid="sample-title"
            onClick={() => setEditing(true)}
            className="text-warm hover:text-molten text-left truncate w-full"
          >
            {sample.title}
          </button>
        )}
        <div className="font-mono text-[10px] text-silver2 uppercase tracking-[0.22em]">
          {sample.kind} · {seconds}s
          {sample.loop && " · loop"}
        </div>
      </div>

      <div className="flex gap-1">
        <button
          type="button"
          data-testid="sample-up"
          disabled={isFirst}
          onClick={() => move(-1)}
          className="
            px-1.5 py-0.5 rounded font-mono text-[10px] text-silver
            border border-glass-soft hover:text-warm disabled:opacity-30
          "
        >
          ↑
        </button>
        <button
          type="button"
          data-testid="sample-down"
          disabled={isLast}
          onClick={() => move(1)}
          className="
            px-1.5 py-0.5 rounded font-mono text-[10px] text-silver
            border border-glass-soft hover:text-warm disabled:opacity-30
          "
        >
          ↓
        </button>
        <button
          type="button"
          data-testid="sample-delete"
          onClick={remove}
          className="
            px-1.5 py-0.5 rounded font-mono text-[10px] text-molten
            border border-molten/40 hover:bg-molten-tint
          "
        >
          ✕
        </button>
      </div>
    </li>
  );
}
