import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Tabla para la configuración activa / ajustes del sistema de control por gestos
  settings: defineTable({
    activeProfile: v.string(),
    sensitivity: v.number(),
    triggerDelay: v.number(),
    cameraEnabled: v.boolean(),
    mappings: v.any(), // JSON que representa el mapeo de gestos a acciones del OS
  }),
  
  // Tabla para registrar el historial de ademanes detectados en vivo, indicando el dispositivo (PC)
  gestureLogs: defineTable({
    gesture: v.string(),
    action: v.string(),
    device: v.optional(v.string()), // Nombre de host de la PC de origen
    timestamp: v.number(),
  }),
});
