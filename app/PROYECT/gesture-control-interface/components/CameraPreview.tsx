"use client"

import { useEffect, useState } from "react"
import { Cpu, Activity } from "lucide-react"

export function CameraPreview({ enabled }: { enabled: boolean }) {
  const [pulse, setPulse] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setPulse((p) => !p)
    }, 1500)
    return () => clearInterval(interval)
  }, [])

  if (!enabled) {
    return (
      <div className="tactical-grid-fine flex aspect-video items-center justify-center rounded-lg bg-zinc-950 text-zinc-500 border border-zinc-900">
        <div className="flex flex-col items-center gap-2">
          <Activity className="size-6 text-zinc-700" />
          <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-600">Sistema Suspendido</span>
        </div>
      </div>
    )
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-zinc-950 border border-zinc-900 flex flex-col items-center justify-center p-4">
      {/* Animated Radar/Scanner Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.015),transparent)] pointer-events-none" />
      <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
      
      {/* Scanner wave sweeps across the panel */}
      <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[bounce_3s_infinite] opacity-60" />

      <div className="flex flex-col items-center gap-3 z-10 text-center">
        {/* Glow pulsing target */}
        <div className="relative flex size-12 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800">
          <Cpu className={`size-5 text-white transition-opacity duration-1000 ${pulse ? 'opacity-100' : 'opacity-40'}`} />
          <span className="absolute -inset-1 rounded-full border border-white/5 animate-ping" />
        </div>

        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-white">
            PROCESAMIENTO LOCAL
          </span>
          <p className="text-[10px] text-zinc-500 max-w-[220px] leading-normal">
            El feed de cámara es procesado por el script de visión de Python para evitar latencia de red.
          </p>
        </div>
      </div>

      {/* Futuristic status bar */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between font-mono text-[8px] text-zinc-500 uppercase tracking-wider border-t border-zinc-900 pt-2">
        <span className="flex items-center gap-1.5">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
          </span>
          Servicio Activo
        </span>
        <span>Cam: Local / Loopback</span>
      </div>
    </div>
  )
}
