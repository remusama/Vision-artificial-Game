"use client"

import { AnimatePresence, motion } from "motion/react"
import type { LucideIcon } from "lucide-react"

export type GestureToast = {
  id: string
  /** Icon representing the detected gesture */
  icon: LucideIcon
  /** Human label of the gesture, e.g. "Open Palm" */
  gesture: string
  /** Action that was executed, e.g. "Play / Pause" */
  action: string
  /** Cooldown duration in ms; drives the progress ring */
  cooldown?: number
}

type GestureHudToastProps = {
  toast: GestureToast | null
  onCooldownComplete?: (id: string) => void
}

const RING_SIZE = 52
const RING_STROKE = 2.5
const RADIUS = (RING_SIZE - RING_STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function GestureHudToast({ toast, onCooldownComplete }: GestureHudToastProps) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-6 bottom-6 z-50 flex justify-end px-4"
    >
      <AnimatePresence mode="wait">
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 24, scale: 0.9, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 12, scale: 0.95, filter: "blur(6px)" }}
            transition={{ type: "spring", stiffness: 420, damping: 30, mass: 0.7 }}
            className="pointer-events-auto flex items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 py-3 pl-3 pr-5 shadow-2xl shadow-black/80 backdrop-blur-xl"
          >
            {/* Icon + cooldown ring */}
            <div className="relative flex items-center justify-center" style={{ width: RING_SIZE, height: RING_SIZE }}>
              <svg
                width={RING_SIZE}
                height={RING_SIZE}
                viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
                className="absolute inset-0 -rotate-90"
                aria-hidden="true"
              >
                <circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={RING_STROKE}
                  className="text-zinc-800"
                />
                <motion.circle
                  key={`${toast.id}-ring`}
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={RING_STROKE}
                  strokeLinecap="round"
                  className="text-white"
                  strokeDasharray={CIRCUMFERENCE}
                  initial={{ strokeDashoffset: 0 }}
                  animate={{ strokeDashoffset: CIRCUMFERENCE }}
                  transition={{ duration: (toast.cooldown ?? 2000) / 1000, ease: "linear" }}
                  onAnimationComplete={() => onCooldownComplete?.(toast.id)}
                />
              </svg>
              <motion.div
                key={`${toast.id}-icon`}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 22, delay: 0.05 }}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white border border-white/10"
              >
                <toast.icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
              </motion.div>
            </div>

            {/* Text */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[0.65rem] font-medium uppercase tracking-[0.18em] text-zinc-400">
                {toast.gesture}
              </span>
              <span className="text-sm font-semibold leading-tight text-white">{toast.action}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

