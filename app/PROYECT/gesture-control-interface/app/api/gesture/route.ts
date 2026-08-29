import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import fs from "fs";
import path from "path";

// Obtener el cliente de Convex de forma dinámica para evitar desincronizaciones de variables de entorno en local
function getConvexClient() {
  let url = process.env.NEXT_PUBLIC_CONVEX_URL || process.env.CONVEX_DEPLOYMENT_URL || "";
  
  if (!url) {
    try {
      const envPath = path.join(process.cwd(), ".env.local");
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf-8");
        const match = content.match(/NEXT_PUBLIC_CONVEX_URL\s*=\s*([^\s]+)/);
        if (match && match[1]) {
          url = match[1].replace(/['"]/g, "");
        }
      }
    } catch (e) {
      console.error("Error al leer .env.local dinámicamente:", e);
    }
  }

  return url ? new ConvexHttpClient(url) : null;
}

// POST: Registrar un log de ademán detectado desde el sistema local de Python
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { gesture, action, secret } = body;

    // Validación de seguridad mediante clave secreta compartida
    const expectedSecret = process.env.API_SECRET_KEY || "ademangesturesecret123";
    if (secret !== expectedSecret) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (!gesture || !action) {
      return NextResponse.json({ error: "Faltan parámetros de gesto o acción" }, { status: 400 });
    }

    const client = getConvexClient();
    if (!client) {
      return NextResponse.json({ error: "Servicio Convex no configurado (NEXT_PUBLIC_CONVEX_URL vacía)" }, { status: 500 });
    }

    // Guardar el log en la base de datos de Convex
    await client.mutation(api.gestureLogs.addLog, { gesture, action });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET: Obtener las configuraciones actuales y mapeos de gestos
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const expectedSecret = process.env.API_SECRET_KEY || "ademangesturesecret123";
    
    // Validar token de seguridad en parámetros o cabecera
    const secret = req.nextUrl.searchParams.get("secret") || authHeader;
    if (secret !== expectedSecret) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const client = getConvexClient();
    if (!client) {
      return NextResponse.json({ error: "Servicio Convex no configurado (NEXT_PUBLIC_CONVEX_URL vacía)" }, { status: 500 });
    }

    // Obtener los ajustes desde la base de datos
    const settings = await client.query(api.settings.getSettings);
    return NextResponse.json({ settings });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
