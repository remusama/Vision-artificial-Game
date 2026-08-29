'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Radar, Hand, Settings } from 'lucide-react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../convex/_generated/api'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ControlPanel } from '@/components/control-panel'
import { GestureCard } from '@/components/gesture-card'
import { AdvancedSettings } from '@/components/advanced-settings'
import { CalibrationModal } from '@/components/calibration-modal'
import { GestureHudToast, type GestureToast } from '@/components/gesture-hud-toast'
import { FruitNinjaGame, type FruitNinjaGameRef } from '@/components/FruitNinjaGame'
import { CameraPreview } from '@/components/CameraPreview'
import { GestureHistory } from '@/components/gesture-history'
import { PythonSettings } from '@/components/python-settings'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  DEFAULT_MAPPINGS,
  GESTURES,
  OS_ACTIONS,
  PROFILE_MAPPINGS,
  type GestureId,
  type OsActionId,
} from '@/lib/gestures'

export default function Page() {
  const settings = useQuery(api.settings.getSettings)
  const updateSettings = useMutation(api.settings.updateSettings)

  const [mappings, setMappings] =
    useState<Record<GestureId, OsActionId>>(DEFAULT_MAPPINGS)
  const [sensitivity, setSensitivity] = useState(65)
  const [triggerDelay, setTriggerDelay] = useState(200)
  const [cameraEnabled, setCameraEnabled] = useState(true)
  const [activeProfile, setActiveProfile] = useState('escritorio')

  // States for navigation, calibration modal and HUD feedback
  const [activeTab, setActiveTab] = useState<'control' | 'game'>('control')
  const [isCalibrationOpen, setIsCalibrationOpen] = useState(false)
  const [hudToast, setHudToast] = useState<GestureToast | null>(null)

  // Local logs state for offline vercel/standalone mode
  const [localLogs, setLocalLogs] = useState<{ id: string; gesture: string; action: string; timestamp: number }[]>([])

  // Game ref to simulate slashes
  const gameRef = useRef<FruitNinjaGameRef>(null)

  // Sincronizar desde Convex al cargar la página
  useEffect(() => {
    if (settings) {
      setMappings(settings.mappings as Record<GestureId, OsActionId>)
      setSensitivity(settings.sensitivity)
      setTriggerDelay(settings.triggerDelay)
      setCameraEnabled(settings.cameraEnabled)
      setActiveProfile(settings.activeProfile)
    }
  }, [settings])

  const addLocalLog = useCallback((gestureName: string, actionLabel: string) => {
    setLocalLogs((prev) => [
      {
        id: crypto.randomUUID(),
        gesture: gestureName,
        action: actionLabel,
        timestamp: Date.now(),
      },
      ...prev.slice(0, 9)
    ])
  }, [])

  const handleTestHUD = useCallback(() => {
    const gestureObj = GESTURES.find((g) => g.id === 'pinch')
    if (gestureObj) {
      const actionLabel = 'Reproducir / Pausar'
      addLocalLog('Pinza detectada', actionLabel)
      setHudToast({
        id: crypto.randomUUID(),
        icon: gestureObj.icon,
        gesture: 'Pinza detectada',
        action: actionLabel,
        cooldown: 1500,
      })
    }
  }, [addLocalLog])

  const handleSimulateGesture = useCallback((gestureId: GestureId) => {
    const gestureObj = GESTURES.find((g) => g.id === gestureId)
    const actionId = mappings[gestureId]
    const actionObj = OS_ACTIONS.find((a) => a.id === actionId)
    if (gestureObj) {
      const actionLabel = actionObj?.label || 'Sin Asignar'
      addLocalLog(gestureObj.name, actionLabel)
      setHudToast({
        id: crypto.randomUUID(),
        icon: gestureObj.icon,
        gesture: gestureObj.name,
        action: actionLabel,
        cooldown: 2000,
      })
    }

    // Trigger slice slash on Canvas if in Modo Juego
    if (activeTab === 'game') {
      if (gestureId === 'swipe-left') {
        gameRef.current?.triggerSwipeSlice('left')
      } else if (gestureId === 'swipe-right') {
        gameRef.current?.triggerSwipeSlice('right')
      } else {
        gameRef.current?.triggerSwipeSlice('random')
      }
    }
  }, [mappings, activeTab, addLocalLog])

  const handleCooldownComplete = useCallback((id: string) => {
    setHudToast((current) => (current?.id === id ? null : current))
  }, [])

  const handleMappingChange = useCallback((gesture: GestureId, action: OsActionId) => {
    setMappings((prev) => {
      const next = { ...prev, [gesture]: action }
      // Intentar actualizar en Convex de forma silenciosa
      try {
        updateSettings({ mappings: next })
      } catch (err) {
        console.warn("No se pudo guardar la configuración en Convex (Modo Offline).", err)
      }
      return next
    })
    
    // Auto-trigger HUD feedback on mapping change to preview
    const gestureObj = GESTURES.find((g) => g.id === gesture)
    const actionObj = OS_ACTIONS.find((a) => a.id === action)
    if (gestureObj) {
      const actionLabel = actionObj?.label || 'Sin Asignar'
      addLocalLog(gestureObj.name, actionLabel)
      setHudToast({
        id: crypto.randomUUID(),
        icon: gestureObj.icon,
        gesture: gestureObj.name,
        action: actionLabel,
        cooldown: 2000,
      })
    }
  }, [updateSettings, addLocalLog])

  const handleCameraToggle = useCallback((value: boolean) => {
    setCameraEnabled(value)
    updateSettings({ cameraEnabled: value })
  }, [updateSettings])

  const handleProfileChange = useCallback((id: string) => {
    setActiveProfile(id)
    if (id === 'fruit-ninja') {
      setActiveTab('game')
    }
    const preset = PROFILE_MAPPINGS[id]
    if (preset) {
      setMappings(preset)
      updateSettings({ activeProfile: id, mappings: preset })
    }
  }, [updateSettings])

  const handleSave = useCallback(() => {
    PROFILE_MAPPINGS[activeProfile] = { ...mappings }
    updateSettings({
      activeProfile,
      sensitivity,
      triggerDelay,
      cameraEnabled,
      mappings,
    })
  }, [activeProfile, mappings, sensitivity, triggerDelay, cameraEnabled, updateSettings])

  const handleReset = useCallback(() => {
    setMappings(DEFAULT_MAPPINGS)
    setSensitivity(65)
    setTriggerDelay(200)
    updateSettings({
      mappings: DEFAULT_MAPPINGS,
      sensitivity: 65,
      triggerDelay: 200,
    })
  }, [updateSettings])

  const activeCount = Object.values(mappings).filter(
    (action) => action !== 'none',
  ).length

  return (
    <div className="tactical-grid min-h-screen bg-background text-foreground relative flex flex-col">
      {/* Navigation Header Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
          {/* Logo / Brand */}
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-white text-black">
              <Hand className="size-5" aria-hidden="true" />
            </span>
            <div className="flex flex-col">
              <span className="text-base font-semibold leading-none tracking-tight">
                Ademán
              </span>
              <span className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-400">
                Workspace
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex space-x-1 rounded-lg bg-zinc-900 p-1 border border-zinc-850" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('control')}
              className={cn(
                "rounded-md px-4 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                activeTab === 'control'
                  ? "bg-white text-black shadow-sm"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              Centro de Control
            </button>
            <button
              onClick={() => setActiveTab('game')}
              className={cn(
                "rounded-md px-4 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                activeTab === 'game'
                  ? "bg-white text-black shadow-sm"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              Modo Juego
            </button>
          </nav>

          {/* Right Action: Test HUD & Calibration Trigger */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestHUD}
              className="gap-2 text-xs border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-white"
            >
              <Radar className="size-3.5 animate-pulse text-zinc-400" aria-hidden="true" />
              Probar HUD
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCalibrationOpen(true)}
              className="gap-2 text-xs border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-white"
            >
              <Settings className="size-3.5" aria-hidden="true" />
              Calibrar Cámara
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
        {activeTab === 'control' ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[17rem_minmax(0,1fr)_20rem]">
            {/* Column 1 — Control, status & Convex Logs */}
            <div className="flex flex-col gap-6">
              <ControlPanel
                cameraEnabled={cameraEnabled}
                onCameraToggle={handleCameraToggle}
                activeProfile={activeProfile}
                onProfileChange={handleProfileChange}
                onOpenCalibration={() => setIsCalibrationOpen(true)}
              />
              <GestureHistory localLogs={localLogs} />
            </div>

            {/* Column 2 — Gesture mapping */}
            <main className="flex flex-col gap-4">
              <div className="flex items-end justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <h1 className="text-xl font-semibold tracking-tight text-balance">
                    Mapeo de Gestos
                  </h1>
                  <p className="text-sm text-foreground/70">
                    Asigna una acción del sistema a cada gesto reconocido.
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-2 rounded-full bg-panel px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-foreground/70 ring-1 ring-sidebar-border">
                  <Radar className="size-3.5 text-white" aria-hidden="true" />
                  {activeCount}/{GESTURES.length} activos
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {GESTURES.map((gesture) => (
                  <GestureCard
                    key={gesture.id}
                    gesture={gesture}
                    action={mappings[gesture.id]}
                    onChange={handleMappingChange}
                    onSimulate={handleSimulateGesture}
                    disabled={!cameraEnabled}
                  />
                ))}
              </div>

              {!cameraEnabled && (
                <Card className="border-dashed border-zinc-800">
                  <CardContent className="py-4 text-center text-sm text-muted-foreground">
                    El seguimiento de cámara está desactivado. Actívalo desde el
                    panel de control para detectar gestos.
                  </CardContent>
                </Card>
              )}
            </main>

            {/* Column 3 — Advanced settings */}
            <div className="flex flex-col gap-6">
              <AdvancedSettings
                sensitivity={sensitivity}
                onSensitivityChange={setSensitivity}
                triggerDelay={triggerDelay}
                onTriggerDelayChange={setTriggerDelay}
                onSave={handleSave}
                onReset={handleReset}
                disabled={!cameraEnabled}
              />

              <PythonSettings />

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Vista de Cámara</CardTitle>
                  <CardDescription>
                    Previsualización del seguimiento en vivo.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CameraPreview enabled={cameraEnabled} />
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          /* Game Mode Interactive View - Full screen fixed viewport */
          <div className="fixed inset-0 z-50 w-screen h-screen bg-zinc-950 flex flex-col justify-center items-center animate-fade-in">
            <FruitNinjaGame ref={gameRef} onExitGame={() => setActiveTab('control')} />
          </div>
        )}
      </div>

      {/* Overlay Layers */}
      {isCalibrationOpen && (
        <CalibrationModal onClose={() => setIsCalibrationOpen(false)} />
      )}

      <GestureHudToast
        toast={hudToast}
        onCooldownComplete={handleCooldownComplete}
      />
    </div>
  )
}
