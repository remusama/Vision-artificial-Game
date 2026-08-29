'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, Sliders } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

type PythonConfig = {
  camera_source: string
  game_mode: string
  target_hand: string
  sens_val: number
  suav_val: number
}

export function PythonSettings() {
  const [config, setConfig] = useState<PythonConfig>({
    camera_source: "0",
    game_mode: "normal",
    target_hand: "DERECHA",
    sens_val: 3,
    suav_val: 10,
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")

  const fetchConfig = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/python-config')
      if (res.ok) {
        const data = await res.json()
        setConfig({
          ...data,
          sens_val: Number(data.sens_val) || 3,
          suav_val: Number(data.suav_val) || 10
        })
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConfig()
  }, [])

  const saveConfig = async () => {
    setSaving(true)
    setStatusMessage("")
    try {
      const res = await fetch('/api/python-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })
      if (res.ok) {
        setStatusMessage("Ajustes aplicados al motor local en caliente.")
        setTimeout(() => setStatusMessage(""), 4000)
      } else {
        setStatusMessage("Error al guardar la configuración.")
      }
    } catch (e) {
      console.error(e)
      setStatusMessage("Error de conexión.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-zinc-850 bg-zinc-900/60 text-white shadow-xl backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Sliders className="size-4 text-white" />
            <CardTitle className="text-sm font-semibold tracking-wide font-mono">
              Ajustes del Motor Local (Python)
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchConfig}
            disabled={loading}
            className="size-7 hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
            title="Recargar configuración"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <CardDescription className="text-zinc-400 text-xs leading-relaxed">
          Controla los parámetros de visión artificial y filtros de movimiento directamente desde el navegador.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {/* Camera source */}
        <div className="flex flex-col gap-2">
          <Label className="text-xs text-zinc-300 font-medium">Origen de Cámara / ESP32-CAM</Label>
          <input
            type="text"
            value={config.camera_source}
            onChange={(e) => setConfig({ ...config, camera_source: e.target.value })}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-xs text-white placeholder-zinc-650 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400"
            placeholder="0 (Webcam) o IP (ej: 192.168.1.50)"
          />
          <p className="text-[10px] text-zinc-500 leading-normal">
            Ingresa 0 para la webcam local o la dirección IP de tu cámara ESP32-CAM.
          </p>
        </div>

        {/* Sensitivity & Smoothing Sliders */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-zinc-300">Sensibilidad</span>
              <span className="text-white font-semibold">{config.sens_val}</span>
            </div>
            <Slider
              value={[Number(config.sens_val) || 3]}
              min={1}
              max={5}
              step={1}
              onValueChange={(val) => setConfig({ ...config, sens_val: Number(val[0]) })}
              className="py-1 cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-zinc-300">Suavidad (Filtro 1-Euro)</span>
              <span className="text-white font-semibold">{config.suav_val}</span>
            </div>
            <Slider
              value={[Number(config.suav_val) || 10]}
              min={1}
              max={15}
              step={1}
              onValueChange={(val) => setConfig({ ...config, suav_val: Number(val[0]) })}
              className="py-1 cursor-pointer"
            />
          </div>
        </div>

        {/* Hand selection */}
        <div className="flex flex-col gap-2 pt-1">
          <Label className="text-xs text-zinc-300 font-medium">Mano Activa de Control</Label>
          <div className="flex gap-3 mt-1">
            {["DERECHA", "IZQUIERDA"].map((hand) => (
              <button
                key={hand}
                type="button"
                onClick={() => setConfig({ ...config, target_hand: hand })}
                className={cn(
                  "flex-1 py-2 rounded-lg border text-xs font-semibold font-mono transition-all cursor-pointer",
                  config.target_hand === hand
                    ? "bg-white text-black border-white"
                    : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white"
                )}
              >
                {hand === "DERECHA" ? "Derecha" : "Izquierda"}
              </button>
            ))}
          </div>
        </div>

        {/* Mode of operation */}
        <div className="flex flex-col gap-2 border-t border-zinc-800 pt-4">
          <Label className="text-xs text-zinc-300 font-medium">Modo de Ejecución</Label>
          <div className="flex flex-col gap-2 mt-1">
            {[
              { id: "normal", title: "Escritorio / Gestos Completos", desc: "Mapeo genérico para control general del sistema." },
              { id: "fruitninja", title: "Fruit Ninja (Tajos Continuos)", desc: "Movimiento libre ininterrumpido optimizado para rebanar." },
              { id: "osugame", title: "OSU! Game (Clics Rápidos)", desc: "Seguimiento ágil con clics instantáneos por pinch." }
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setConfig({ ...config, game_mode: mode.id })}
                className={cn(
                  "w-full text-left p-3 rounded-lg border transition-all cursor-pointer",
                  config.game_mode === mode.id
                    ? "bg-white/[0.04] border-zinc-400 text-white"
                    : "bg-zinc-950/30 border-zinc-850 text-zinc-400 hover:border-zinc-800 hover:text-zinc-200"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "size-2 rounded-full",
                    config.game_mode === mode.id ? "bg-white" : "bg-zinc-800"
                  )} />
                  <span className="text-xs font-semibold">{mode.title}</span>
                </div>
                <p className="text-[10px] text-zinc-500 mt-1 pl-4 leading-normal">{mode.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <div className="flex flex-col gap-2 border-t border-zinc-800 pt-4">
          <Button
            onClick={saveConfig}
            disabled={saving}
            className="w-full bg-white hover:bg-zinc-200 text-black font-semibold text-xs py-5 cursor-pointer shadow-lg"
          >
            {saving ? "Aplicando..." : "Aplicar Cambios"}
          </Button>

          {statusMessage && (
            <p className="text-[10px] text-zinc-300 text-center font-mono animate-fade-in mt-1">
              {statusMessage}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
