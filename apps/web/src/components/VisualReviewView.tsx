"use client";

import { useState } from "react";

import type { LowConfidenceReason, VisualBlock, VisualAnalysis } from "@/types";

// The taxonomy keys supported by the backend, grouped for the relabel dropdown.
const EXERCISE_OPTIONS: { key: string; label: string }[] = [
  // Push
  { key: "bench_press", label: "Bench Press" },
  { key: "incline_bench_press", label: "Incline Bench Press" },
  { key: "decline_bench_press", label: "Decline Bench Press" },
  { key: "overhead_press", label: "Overhead Press" },
  { key: "seated_dumbbell_press", label: "Seated Dumbbell Press" },
  { key: "pushup", label: "Push-Up" },
  { key: "dip", label: "Dip" },
  { key: "chest_fly", label: "Chest Fly" },
  { key: "cable_fly", label: "Cable Fly" },
  { key: "pec_deck", label: "Pec Deck" },
  { key: "lateral_raise", label: "Lateral Raise" },
  { key: "front_raise", label: "Front Raise" },
  { key: "rear_delt_fly", label: "Rear Delt Fly" },
  { key: "tricep_pushdown", label: "Tricep Pushdown" },
  { key: "skull_crusher", label: "Skull Crusher" },
  { key: "overhead_tricep_extension", label: "Overhead Tricep Extension" },
  // Pull
  { key: "pull_up", label: "Pull-Up" },
  { key: "chin_up", label: "Chin-Up" },
  { key: "lat_pulldown", label: "Lat Pulldown" },
  { key: "barbell_row", label: "Barbell Row" },
  { key: "dumbbell_row", label: "Dumbbell Row" },
  { key: "cable_row", label: "Cable Row" },
  { key: "machine_row", label: "Machine Row" },
  { key: "face_pull", label: "Face Pull" },
  { key: "bicep_curl", label: "Bicep Curl" },
  { key: "hammer_curl", label: "Hammer Curl" },
  { key: "preacher_curl", label: "Preacher Curl" },
  { key: "cable_curl", label: "Cable Curl" },
  { key: "shrug", label: "Shrug" },
  { key: "deadlift", label: "Deadlift" },
  { key: "romanian_deadlift", label: "Romanian Deadlift" },
  // Legs
  { key: "squat", label: "Squat" },
  { key: "front_squat", label: "Front Squat" },
  { key: "goblet_squat", label: "Goblet Squat" },
  { key: "leg_press", label: "Leg Press" },
  { key: "lunge", label: "Lunge" },
  { key: "split_squat", label: "Split Squat" },
  { key: "bulgarian_split_squat", label: "Bulgarian Split Squat" },
  { key: "leg_extension", label: "Leg Extension" },
  { key: "leg_curl", label: "Leg Curl" },
  { key: "hip_thrust", label: "Hip Thrust" },
  { key: "glute_bridge", label: "Glute Bridge" },
  { key: "calf_raise", label: "Calf Raise" },
  { key: "sumo_deadlift", label: "Sumo Deadlift" },
  { key: "hack_squat", label: "Hack Squat" },
  // Core
  { key: "plank", label: "Plank" },
  { key: "side_plank", label: "Side Plank" },
  { key: "crunch", label: "Crunch" },
  { key: "sit_up", label: "Sit-Up" },
  { key: "leg_raise", label: "Leg Raise" },
  { key: "hanging_leg_raise", label: "Hanging Leg Raise" },
  { key: "cable_crunch", label: "Cable Crunch" },
  // Cardio
  { key: "treadmill", label: "Treadmill" },
  { key: "cycling", label: "Cycling" },
  { key: "rowing_machine", label: "Rowing Machine" },
  { key: "jump_rope", label: "Jump Rope" },
  { key: "burpee", label: "Burpee" },
  // Unknown
  { key: "unknown_exercise", label: "Unknown Exercise" },
];

const REASON_LABELS: Record<LowConfidenceReason, string> = {
  clip_too_short: "Clip too short",
  body_out_of_frame: "Body out of frame",
  poor_lighting: "Poor lighting",
  angle_unclear: "Angle unclear",
  visually_similar: "Visually similar to another exercise",
  low_motion: "Low motion",
  model_uncertain: "Model uncertain",
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function confidenceBadge(confidence: number): {
  label: string;
  className: string;
} {
  const pct = Math.round(confidence * 100);
  if (confidence >= 0.65) {
    return {
      label: `${pct}%`,
      className:
        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    };
  }
  if (confidence >= 0.40) {
    return {
      label: `${pct}% , low`,
      className:
        "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    };
  }
  return {
    label: `${pct}% , very low`,
    className:
      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
}

interface BlockRowProps {
  block: VisualBlock;
  onRelabel: (id: string, key: string, label: string) => void;
  onDelete: (id: string) => void;
}

function BlockRow({ block, onRelabel, onDelete }: BlockRowProps) {
  const [editing, setEditing] = useState(false);
  const badge = confidenceBadge(block.confidence);
  const isUnknown =
    !block.exercise_key || block.exercise_key === "unknown_exercise";

  return (
    <div
      className={`rounded-xl border p-4 space-y-3 ${
        isUnknown
          ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/10"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {editing ? (
            <select
              autoFocus
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              defaultValue={block.exercise_key ?? "unknown_exercise"}
              onChange={(e) => {
                const selected = EXERCISE_OPTIONS.find(
                  (o) => o.key === e.target.value,
                );
                if (selected) {
                  onRelabel(block.id, selected.key, selected.label);
                }
                setEditing(false);
              }}
              onBlur={() => setEditing(false)}
            >
              {EXERCISE_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-left group"
              title="Click to relabel"
            >
              <p
                className={`text-base font-semibold ${
                  isUnknown
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-zinc-900 dark:text-zinc-100"
                }`}
              >
                {block.exercise_label ?? "Unknown Exercise"}
                <span className="ml-1.5 text-xs font-normal text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  edit
                </span>
              </p>
            </button>
          )}
          <p className="text-xs text-zinc-400 mt-0.5">
            {formatTime(block.start_time)} – {formatTime(block.end_time)}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${badge.className}`}
          >
            {badge.label}
          </span>
          <button
            onClick={() => onDelete(block.id)}
            className="rounded-md p-1 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Remove this block"
          >
            ✕
          </button>
        </div>
      </div>

      {block.low_confidence_reasons.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {block.low_confidence_reasons.map((r) => (
            <span
              key={r}
              className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
            >
              {REASON_LABELS[r] ?? r}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

interface VisualReviewViewProps {
  jobId: string;
  analysis: VisualAnalysis;
  onConfirmed: () => void;
}

export function VisualReviewView({
  jobId,
  analysis,
  onConfirmed,
}: VisualReviewViewProps) {
  const [blocks, setBlocks] = useState<VisualBlock[]>(analysis.blocks);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const exerciseBlocks = blocks.filter((b) => b.segment_type === "exercise");

  function handleRelabel(id: string, key: string, label: string) {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, exercise_key: key, exercise_label: label } : b,
      ),
    );
  }

  function handleDelete(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }

  async function handleConfirm() {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const { confirmVisualBlocks } = await import("@/lib/api");
      await confirmVisualBlocks(jobId, exerciseBlocks);
      onConfirmed();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Something went wrong",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const unknownCount = exerciseBlocks.filter(
    (b) => !b.exercise_key || b.exercise_key === "unknown_exercise",
  ).length;

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Review Detected Exercises
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          No audio or text was found , exercises were detected visually.
          Relabel or remove anything that looks wrong, then confirm.
        </p>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-lg bg-zinc-100 px-3 py-1.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          {exerciseBlocks.length} exercise{exerciseBlocks.length !== 1 ? "s" : ""} detected
        </span>
        <span className="rounded-lg bg-zinc-100 px-3 py-1.5 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {formatTime(analysis.video_duration)} video
        </span>
        {unknownCount > 0 && (
          <span className="rounded-lg bg-amber-100 px-3 py-1.5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            {unknownCount} unknown , relabel or remove
          </span>
        )}
      </div>

      {/* Block list */}
      {exerciseBlocks.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          No exercise blocks remaining. Add exercises manually after saving, or
          try a different video.
        </div>
      ) : (
        <div className="space-y-3">
          {exerciseBlocks.map((block) => (
            <BlockRow
              key={block.id}
              block={block}
              onRelabel={handleRelabel}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Error */}
      {submitError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {submitError}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleConfirm}
          disabled={isSubmitting || exerciseBlocks.length === 0}
          className="flex-1 rounded-xl bg-zinc-900 px-6 py-3 text-base font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isSubmitting ? "Saving…" : "Confirm & Save Workout"}
        </button>
      </div>

      <p className="text-xs text-zinc-400 dark:text-zinc-500">
        Sets and reps will be empty , fill them in after saving.
      </p>
    </div>
  );
}
