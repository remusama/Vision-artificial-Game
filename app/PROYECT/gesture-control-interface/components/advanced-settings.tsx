'use client'

import { Gauge, RotateCcw, Save, Timer } from 'lucide-react'

import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type AdvancedSettingsProps = {
  sensitivity: number
  onSensitivityChange: (value: number) => void
  triggerDelay: number
  onTriggerDelayChange: (value: number) => void
  onSave: () => void
  onReset: () => void
  disabled?: boolean
}

function sensitivityLabel(value: number) {
  if (value < 30) return 'Baja'
  if (value < 70) return 'Equilibrada'
  return 'Alta'
}

export function AdvancedSettings({
  sensitivity,
  onSensitivityChange,
  triggerDelay,
  onTriggerDelayChange,
  onSave,
  onReset,
  disabled,
}: AdvancedSettingsProps) {
  return (
    <Card className="tactical-grid-fine">
      <CardHeader>
        <CardTitle className="text-base">Ajustes Avanzados</CardTitle>
        <CardDescription>
          Calibra la precisión de la detección de gestos.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-7">
        {/* Sensitivity */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Gauge className="size-4 text-primary" aria-hidden="true" />
              Sensibilidad del Gesto
            </span>
            <span className="flex items-baseline gap-2">
              <span className="font-mono text-sm font-semibold tabular-nums text-primary">
                {sensitivity}
              </span>
              <span className="rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">
                {sensitivityLabel(sensitivity)}
              </span>
            </span>
          </div>
          <Slider
            value={[sensitivity]}
            onValueChange={(value) => onSensitivityChange(value[0])}
            min={0}
            max={100}
            step={1}
            disabled={disabled}
            aria-label="Sensibilidad del gesto"
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Valores altos detectan movimientos más sutiles, con mayor riesgo de
            falsos positivos.
          </p>
        </div>

        {/* Trigger delay */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Timer className="size-4 text-primary" aria-hidden="true" />
              Retraso de Activación
            </span>
            <span className="font-mono text-sm font-semibold tabular-nums text-primary">
              {triggerDelay}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                ms
              </span>
            </span>
          </div>
          <Slider
            value={[triggerDelay]}
            onValueChange={(value) => onTriggerDelayChange(value[0])}
            min={0}
            max={1000}
            step={50}
            disabled={disabled}
            aria-label="Retraso de activación en milisegundos"
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Tiempo de espera antes de que un gesto reconocido ejecute su acción.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 border-t border-border/70 pt-5">
          <Button onClick={onSave} className="w-full justify-center">
            <Save data-icon="inline-start" />
            Guardar Perfil Actual
          </Button>
          <Button
            variant="ghost"
            onClick={onReset}
            className="w-full justify-center"
          >
            <RotateCcw data-icon="inline-start" />
            Restablecer Predeterminados
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
