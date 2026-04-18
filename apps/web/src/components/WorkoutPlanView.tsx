"use client";

import type { WorkoutPlan } from "@/types";

interface WorkoutPlanViewProps {
  plan: WorkoutPlan;
}

export function WorkoutPlanView({ plan }: WorkoutPlanViewProps) {
  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          {plan.title || "Your Workout"}
        </h2>
        <div className="flex flex-wrap gap-2 mt-1">
          {plan.workout_type && (
            <span className="inline-flex items-center rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {plan.workout_type}
            </span>
          )}
          
        </div>
      </div>

      {/* Equipment */}
      {plan.equipment.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
            Equipment
          </h3>
          <div className="flex flex-wrap gap-2">
            {plan.equipment.map((item) => (
              <span
                key={item}
                className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Blocks */}
      {plan.blocks.map((block, blockIdx) => (
        <div
          key={blockIdx}
          className="rounded-2xl border border-zinc-200 bg-white overflow-hidden dark:border-zinc-800 dark:bg-zinc-900"
        >
          {block.name && (
            <div className="border-b border-zinc-100 bg-zinc-50 px-5 py-3 dark:border-zinc-800 dark:bg-zinc-800/50">
              <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                {block.name}
              </h3>
            </div>
          )}
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {block.exercises.map((ex, exIdx) => (
              <div key={exIdx} className="flex items-center justify-between px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className="text-base font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {ex.name}
                  </p>
                  {ex.notes && (
                    <p className="mt-0.5 text-sm text-zinc-400">{ex.notes}</p>
                  )}
                </div>
                <div className="ml-4 flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400 shrink-0">
                  {ex.sets != null && (
                    <span className="tabular-nums">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{ex.sets}</span> sets
                    </span>
                  )}
                  {ex.reps != null && (
                    <span className="tabular-nums">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{ex.reps}</span> reps
                    </span>
                  )}
                  {ex.duration_sec != null && (
                    <span className="tabular-nums">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{ex.duration_sec}</span>s
                    </span>
                  )}
                  {ex.rest_sec != null && (
                    <span className="tabular-nums text-zinc-400">
                      {ex.rest_sec}s rest
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Notes */}
      {plan.notes && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 italic">
          {plan.notes}
        </p>
      )}
    </div>
  );
}
