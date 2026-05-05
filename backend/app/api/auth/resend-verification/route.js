import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json({ error: "Confirmação por email desativada no momento." }, { status: 410 })
}
