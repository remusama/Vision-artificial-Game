"use client"

import { useState, useEffect } from "react"
import { Check, Hand, Grab, Fingerprint, X, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type Step = {
  id: string
  title: string
  hint: string
  icon: React.ElementType
}

const STEPS: Step[] = [
  {
    id: "open-hand",
    title: "Paso 1: Mano abierta frente al sensor",
    hint: "Coloca la palma extendida con los dedos separados frente a la cámara.",
    icon: Hand,
  },
  {
    id: "fist",
    title: "Paso 2: Cerrar puño",
    hint: "Cierra todos los dedos en un puño firme y mantenlo estable.",
    icon: Grab,
  },
  {
    id: "pinch",
    title: "Paso 3: Realizar pinza (índice y pulgar)",
    hint: "Une las puntas de tus dedos pulgar e índice.",
    icon: Fingerprint,
  },
]

export function CalibrationModal({ onClose }: { onClose?: () => void }) {
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [pulse, setPulse] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setPulse((p) => !p)
    }, 1500)
    return () => clearInterval(interval)
  }, [])

  // The first not-yet-completed step is the active one the user should perform.
  const activeIndex = STEPS.findIndex((s) => !completed.has(s.id))
  const activeStep = activeIndex === -1 ? null : STEPS[activeIndex]
  const allDone = activeIndex === -1

  const progress = Math.round((completed.size / STEPS.length) * 100)

  function detect(id: string) {
    setCompleted((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }

  function reset() {
    setCompleted(new Set())
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="calibration-title"
    >
      <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl md:flex-row text-white animate-scale-in">
        
        {/* Schematic Area (Left Side) */}
        <div className="relative flex-grow flex-shrink flex flex-col items-center justify-center bg-zinc-950 md:min-h-[440px] min-h-[300px] overflow-hidden p-6">
          {/* Futuristic background grid */}
          <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.015),transparent)] pointer-events-none" />

          {activeStep && (
            <div className="flex flex-col items-center gap-6 z-10 text-center animate-fade-in">
              <div className="relative flex size-24 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 shadow-xl">
                {activeStep.id === "open-hand" && (
                  <Hand className={`size-10 text-white transition-all duration-1000 ${pulse ? 'scale-110 opacity-100' : 'scale-95 opacity-50'}`} />
                )}
                {activeStep.id === "fist" && (
                  <Grab className={`size-10 text-white transition-all duration-1000 ${pulse ? 'scale-110 opacity-100' : 'scale-95 opacity-50'}`} />
                )}
                {activeStep.id === "pinch" && (
                  <Fingerprint className={`size-10 text-white transition-all duration-1000 ${pulse ? 'scale-110 opacity-100' : 'scale-95 opacity-50'}`} />
                )}
                <span className="absolute -inset-2 rounded-full border border-white/5 animate-pulse" />
                <span className="absolute -inset-4 rounded-full border border-white/5 animate-ping opacity-30" />
              </div>

              <div className="flex flex-col gap-2">
                <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-white">
                  {activeStep.title}
                </span>
                <p className="text-xs text-zinc-400 max-w-[260px] leading-relaxed mx-auto">
                  {activeStep.hint}
                </p>
              </div>
            </div>
          )}

          {allDone && (
            <div className="flex flex-col items-center gap-6 z-10 text-center animate-fade-in">
              <div className="relative flex size-24 items-center justify-center rounded-full bg-white text-black shadow-xl">
                <Check className="size-12 stroke-[2.5]" />
                <span className="absolute -inset-2 rounded-full border border-white/10 animate-pulse" />
              </div>

              <div className="flex flex-col gap-2">
                <span className="font-mono text-sm font-bold uppercase tracking-[0.2em] text-white">
                  CALIBRACIÓN COMPLETADA
                </span>
                <p className="text-xs text-zinc-400 max-w-[260px] leading-relaxed mx-auto">
                  El sensor ha sincronizado los rangos dinámicos. Presiona guardar para finalizar.
                </p>
              </div>
            </div>
          )}

          {/* Framing guide frame */}
          <div className="pointer-events-none absolute inset-6 rounded-lg border border-dashed border-zinc-850 z-20" />

          {/* Live status pill */}
          <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/85 border border-zinc-800 px-3 py-1.5 text-[10px] font-mono font-medium z-20">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                allDone ? "bg-white" : "animate-pulse bg-emerald-500",
              )}
              aria-hidden="true"
            />
            {allDone ? "LISTO" : "CALIBRACIÓN LOCAL"}
          </div>
        </div>

        {/* Checklist side panel */}
        <div className="flex w-full flex-col border-t border-zinc-800 md:w-80 md:border-l md:border-t-0 bg-zinc-900">
          <div className="flex items-start justify-between gap-4 border-b border-zinc-800 p-5">
            <div>
              <h2 id="calibration-title" className="text-base font-semibold text-white font-mono">
                Calibrar Seguimiento
              </h2>
              <p className="mt-1 text-[11px] text-zinc-400">
                Instrucciones ergonómicas para la calibración local del sistema de visión.
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white cursor-pointer"
              aria-label="Cerrar calibración"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Progress */}
          <div className="px-5 pt-4">
            <div className="mb-2 flex items-center justify-between text-xs font-mono">
              <span className="text-zinc-400">PROGRESO</span>
              <span className="font-medium tabular-nums text-white">
                {completed.size}/{STEPS.length}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-white transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Steps */}
          <ul className="flex flex-col gap-2 p-5 overflow-y-auto">
            {STEPS.map((step, index) => {
              const isDone = completed.has(step.id)
              const isActive = !isDone && index === activeIndex
              const Icon = step.icon
              return (
                <li key={step.id}>
                  <div
                    className={cn(
                      "rounded-lg border p-3 transition-colors",
                      isDone
                        ? "border-zinc-850 bg-zinc-900/60"
                        : isActive
                          ? "border-white bg-zinc-800"
                          : "border-zinc-850 bg-transparent opacity-40",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
                          isDone
                            ? "bg-white text-black"
                            : "bg-zinc-800 text-zinc-400",
                        )}
                        aria-hidden="true"
                      >
                        {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-sm font-medium leading-snug",
                            isDone ? "text-white/60" : "text-zinc-200",
                          )}
                        >
                          {step.title}
                        </p>
                        {isActive && (
                          <p className="mt-1 text-[11px] text-zinc-400 leading-normal">{step.hint}</p>
                        )}
                      </div>
                      {isDone && (
                        <span className="text-[9px] font-bold font-mono uppercase tracking-wide text-white">
                          LISTO
                        </span>
                      )}
                    </div>

                    {isActive && (
                      <Button
                        size="sm"
                        className="mt-3 w-full bg-white text-black hover:bg-zinc-200 font-medium text-xs cursor-pointer"
                        onClick={() => detect(step.id)}
                      >
                        Simular detección
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>

          {/* Footer */}
          <div className="mt-auto flex items-center gap-2 border-t border-zinc-800 p-5 bg-zinc-900/90">
            {allDone ? (
              <>
                <Button className="flex-1 bg-white text-black hover:bg-zinc-200 text-xs py-4 font-semibold cursor-pointer" onClick={onClose}>
                  Guardar y Finalizar
                </Button>
                <Button variant="outline" size="icon" className="border-zinc-800 text-white hover:bg-zinc-800 cursor-pointer" onClick={reset} aria-label="Reiniciar">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <p className="text-[10px] text-zinc-400 font-mono tracking-wider uppercase">
                {activeStep ? `SIGUIENTE: ${activeStep.title.split(":")[0]}` : ""}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
