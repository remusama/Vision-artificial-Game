'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  OS_ACTIONS,
  type Gesture,
  type GestureId,
  type OsActionId,
} from '@/lib/gestures'

type GestureCardProps = {
  gesture: Gesture
  action: OsActionId
  onChange: (gesture: GestureId, action: OsActionId) => void
  disabled?: boolean
  onSimulate?: (gesture: GestureId) => void
}

export function GestureCard({
  gesture,
  action,
  onChange,
  disabled,
  onSimulate,
}: GestureCardProps) {
  const [open, setOpen] = useState(false)
  const Icon = gesture.icon
  const isAssigned = action !== 'none'
  const actionLabel =
    OS_ACTIONS.find((a) => a.id === action)?.label ?? 'Sin Asignar'

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-card text-card-foreground transition-opacity',
        disabled && 'opacity-55',
      )}
    >
      {/* Header row (click to expand) */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </span>

        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[0.95rem] font-semibold leading-tight">
            {gesture.name}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            <span
              className={cn(
                'inline-block size-1.5 rounded-full',
                isAssigned ? 'bg-primary' : 'bg-muted-foreground/50',
              )}
              aria-hidden="true"
            />
            {actionLabel}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span
            className={cn(
              'hidden rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest sm:inline-block',
              isAssigned
                ? 'bg-primary/15 text-primary'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {isAssigned ? 'Activo' : 'Inactivo'}
          </span>
          <ChevronDown
            className={cn(
              'size-4 text-muted-foreground transition-transform duration-200',
              open && 'rotate-180',
            )}
            aria-hidden="true"
          />
        </div>
      </button>

      {/* Expandable body */}
      {open && (
        <div className="border-t border-border/70 px-4 py-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {gesture.description}
          </p>

          <div className="mt-4 flex flex-col gap-1.5">
            <label
              htmlFor={`action-${gesture.id}`}
              className="font-mono text-[11px] font-medium uppercase tracking-wider text-card-foreground/70"
            >
              Acción del Sistema
            </label>
            <Select
              items={OS_ACTIONS.map((os) => ({
                label: os.label,
                value: os.id,
              }))}
              value={action}
              onValueChange={(value) =>
                onChange(gesture.id, value as OsActionId)
              }
              disabled={disabled}
            >
              <SelectTrigger
                id={`action-${gesture.id}`}
                className="w-full bg-background/60"
              >
                <SelectValue placeholder="Selecciona una acción" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {OS_ACTIONS.map((os) => (
                    <SelectItem key={os.id} value={os.id}>
                      {os.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onSimulate?.(gesture.id)}
              className="mt-3.5 w-full justify-center border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-white"
              disabled={disabled}
            >
              Simular Detección
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
