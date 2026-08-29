import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Obtener los ajustes activos. Crea valores por defecto si la base de datos está vacía.
export const getSettings = query({
  handler: async (ctx) => {
    const settings = await ctx.db.query("settings").first();
    if (!settings) {
      return {
        activeProfile: "escritorio",
        sensitivity: 65,
        triggerDelay: 200,
        cameraEnabled: true,
        mappings: {
          "pinch": "click",
          "v-sign": "drag",
          "fist": "show-desktop",
          "open-palm": "hover",
          "swipe-left": "swipe-left",
          "swipe-right": "swipe-right",
        },
      };
    }
    return settings;
  },
});

// Guardar o actualizar los ajustes en tiempo real
export const updateSettings = mutation({
  args: {
    activeProfile: v.optional(v.string()),
    sensitivity: v.optional(v.number()),
    triggerDelay: v.optional(v.number()),
    cameraEnabled: v.optional(v.boolean()),
    mappings: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("settings").first();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("settings", {
        activeProfile: args.activeProfile ?? "escritorio",
        sensitivity: args.sensitivity ?? 65,
        triggerDelay: args.triggerDelay ?? 200,
        cameraEnabled: args.cameraEnabled ?? true,
        mappings: args.mappings ?? {},
      });
    }
  },
});
