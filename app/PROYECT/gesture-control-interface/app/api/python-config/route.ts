import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const configPath = path.join(process.cwd(), "..", "..", "..", "mediapipe", "config.json");

export async function GET() {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, "utf-8");
      return NextResponse.json(JSON.parse(data));
    }
    // Fallback por defecto si no existe el archivo local o estamos en Vercel
    return NextResponse.json({
      camera_source: "0",
      game_mode: "normal",
      target_hand: "DERECHA",
      sens_val: 3,
      suav_val: 10,
      zone_x: [0.2, 0.8],
      zone_y: [0.2, 0.8]
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    let currentConfig = {};
    if (fs.existsSync(configPath)) {
      try {
        currentConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      } catch {}
    }
    
    const newConfig = {
      ...currentConfig,
      ...body
    };
    
    // Validar si el directorio existe (ej. mediapipe en local) para evitar caídas en producción serverless (Vercel)
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      console.warn("Directorio local del motor de Python no encontrado en Vercel.");
      return NextResponse.json({ success: true, warning: "Corriendo en modo serverless (sin persistencia local)" });
    }
    
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 4), "utf-8");
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
