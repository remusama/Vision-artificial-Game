"use client";

import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Activity, Radio } from "lucide-react";
import { useEffect, useState } from "react";

type LocalLog = {
  id: string;
  gesture: string;
  action: string;
  timestamp: number;
}

export function GestureHistory({ localLogs = [] }: { localLogs?: LocalLog[] }) {
  const logs = useQuery(api.gestureLogs.getRecentLogs, { limit: 10 });
  const [isOffline, setIsOffline] = useState(true);

  useEffect(() => {
    // Detectar si estamos en un entorno serverless sin Convex configurado (Vercel)
    if (typeof window !== "undefined") {
      const hasConvexUrl = !!process.env.NEXT_PUBLIC_CONVEX_URL;
      const onVercel = window.location.hostname.includes("vercel.app");
      setIsOffline(!hasConvexUrl || onVercel);
    }
  }, []);

  const displayLogs = isOffline ? localLogs : (logs || []);

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-sidebar p-5 text-sidebar-foreground ring-1 ring-sidebar-border">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/60">
          {isOffline ? "Historial (Modo Local / Web)" : "Historial de Gestos (Convex)"}
        </span>
        <Activity className={`size-4 ${isOffline ? 'text-zinc-500' : 'text-brand animate-pulse'}`} />
      </div>
      
      <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
        {/* Si está conectándose en modo online */}
        {!isOffline && !logs ? (
          <div className="flex items-center justify-center py-6 gap-2 text-zinc-500 font-mono text-[10px]">
            <Radio className="size-3.5 animate-pulse text-zinc-500" />
            CONECTANDO CON CONVEX...
          </div>
        ) : displayLogs.length === 0 ? (
          <div className="text-zinc-500 font-mono text-[10px] text-center py-6 uppercase tracking-wider">
            Sin actividad de gestos aún
          </div>
        ) : (
          displayLogs.map((log: any) => (
            <div 
              key={log._id || log.id} 
              className="flex items-center justify-between bg-zinc-950/40 px-3 py-2 rounded-lg border border-zinc-900/60 font-mono text-[10px] transition-all hover:bg-zinc-900/50"
            >
              <div className="flex flex-col">
                <span className="text-zinc-300 font-semibold">{log.gesture}</span>
                <span className="text-zinc-500 text-[8px] mt-0.5">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <span className="text-zinc-650 text-xs">→</span>
              <span className="text-white/80 font-medium">{log.action}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
