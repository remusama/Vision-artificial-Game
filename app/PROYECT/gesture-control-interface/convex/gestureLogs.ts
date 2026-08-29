import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Registrar una nueva acción de ademán detectada, registrando opcionalmente el host de la PC
export const addLog = mutation({
  args: {
    gesture: v.string(),
    action: v.string(),
    device: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("gestureLogs", {
      gesture: args.gesture,
      action: args.action,
      device: args.device,
      timestamp: Date.now(),
    });
  },
});

// Obtener los logs más recientes del sistema de visión artificial
export const getRecentLogs = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    return await ctx.db
      .query("gestureLogs")
      .order("desc")
      .take(limit);
  },
});
