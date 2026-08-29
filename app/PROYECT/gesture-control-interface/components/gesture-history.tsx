"use client";

import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Activity, Radar, RefreshCw } from "lucide-react";

export function GestureHistory() {
  // Suscribirse a los últimos 10 logs de ademanes en Convex
  const logs = useQuery(api.gestureLogs.getRecentLogs, { limit: 10 });

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-sidebar p-5 text-sidebar-foreground ring-1 ring-sidebar-border">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/60">
          Historial de Gestos (Convex)
        </span>
        <Activity className="size-4 text-brand animate-pulse" />
      </div>
      
      <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
        {!logs ? (
          <div className="flex items-center justify-center py-6 gap-2 text-zinc-500 font-mono text-[10px]">
            <RefreshCw className="size-3.5 animate-spin" />
            CONECTANDO CON CONVEX...
          </div>
        ) : logs.length === 0 ? (
          <div className="text-zinc-500 font-mono text-[10px] text-center py-6 uppercase tracking-wider">
            Sin actividad de gestos aún
          </div>
        ) : (
          logs.map((log) => (
            <div 
              key={log._id} 
              className="flex items-center justify-between bg-zinc-950/40 px-3 py-2 rounded-lg border border-zinc-900/60 font-mono text-[10px] transition-all hover:bg-zinc-900/50"
            >
              <div className="flex flex-col">
                <span className="text-zinc-300 font-semibold">{log.gesture}</span>
                <span className="text-zinc-500 text-[8px] mt-0.5">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <span className="text-zinc-600 text-xs">→</span>
              <span className="text-brand font-medium">{log.action}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
