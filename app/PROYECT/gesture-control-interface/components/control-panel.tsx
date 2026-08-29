'use client'

import { Camera, CameraOff, Hand, Settings } from 'lucide-react'

import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PROFILES } from '@/lib/gestures'

type ControlPanelProps = {
  cameraEnabled: boolean
  onCameraToggle: (value: boolean) => void
  activeProfile: string
  onProfileChange: (id: string) => void
  onOpenCalibration?: () => void
}

export function ControlPanel({
  cameraEnabled,
  onCameraToggle,
  activeProfile,
  onProfileChange,
  onOpenCalibration,
}: ControlPanelProps) {
  return (
    <aside className="flex flex-col gap-6 rounded-2xl bg-sidebar p-5 text-sidebar-foreground ring-1 ring-sidebar-border">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-brand text-brand-foreground">
          <Hand className="size-6" aria-hidden="true" />
        </span>
        <div className="flex flex-col">
          <span className="text-lg font-semibold leading-none tracking-tight">
            Ademán
          </span>
          <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/60">
            Control por Gestos
          </span>
        </div>
      </div>

      {/* Camera connection status */}
      <section className="flex flex-col gap-3 rounded-xl bg-sidebar-accent/50 p-4 ring-1 ring-sidebar-border">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-wider text-sidebar-foreground/60">
            Estado de Cámara
          </span>
          <span className="flex items-center gap-1.5">
            <span className="relative flex size-2.5">
              {cameraEnabled && (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
              )}
              <span
                className={cn(
                  'relative inline-flex size-2.5 rounded-full',
                  cameraEnabled ? 'bg-success' : 'bg-destructive',
                )}
              />
            </span>
            <span
              className={cn(
                'font-mono text-[11px] font-semibold uppercase tracking-wider',
                cameraEnabled ? 'text-brand' : 'text-destructive',
              )}
            >
              {cameraEnabled ? 'Conectada' : 'Desconectada'}
            </span>
          </span>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-background/40 px-3 py-2.5 ring-1 ring-sidebar-border">
          <span className="flex items-center gap-2.5 text-sm">
            {cameraEnabled ? (
              <Camera className="size-4 text-brand" aria-hidden="true" />
            ) : (
              <CameraOff
                className="size-4 text-sidebar-foreground/50"
                aria-hidden="true"
              />
            )}
            <span className="text-sidebar-foreground/90">
              Seguimiento de mano
            </span>
          </span>
          <Switch
            checked={cameraEnabled}
            onCheckedChange={onCameraToggle}
            aria-label="Activar seguimiento de cámara"
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onOpenCalibration}
          className="w-full justify-center gap-2 text-xs border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-white"
        >
          <Settings className="size-3.5" aria-hidden="true" />
          Calibrar Cámara
        </Button>
      </section>

      {/* App profiles */}
      <section className="flex flex-col gap-3">
        <span className="font-mono text-[11px] uppercase tracking-wider text-sidebar-foreground/60">
          Perfiles de Aplicación
        </span>
        <ul className="flex flex-col gap-1.5">
          {PROFILES.map((profile) => {
            const Icon = profile.icon
            const active = profile.id === activeProfile
            return (
              <li key={profile.id}>
                <button
                  type="button"
                  onClick={() => onProfileChange(profile.id)}
                  aria-pressed={active}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-brand/40',
                    active
                      ? 'bg-brand text-brand-foreground'
                      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/70',
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="font-medium">{profile.name}</span>
                  {active && (
                    <span className="ml-auto font-mono text-[10px] font-semibold uppercase tracking-wider">
                      Activo
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </aside>
  )
}
