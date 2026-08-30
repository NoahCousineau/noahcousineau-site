import { NextResponse } from "next/server";
import { issueGate } from "@/lib/gate";

export async function POST(request: Request) {
  const SITE_PASSWORD = process.env.SITE_PASSWORD;
  if (!SITE_PASSWORD) {
    return NextResponse.json(
      { ok: false, error: "Password not configured on server." },
      { status: 500 }
    );
  }

  let pass = "";
  try {
    const body = await request.json();
    pass = String(body.pass || "");
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // constant-time compare to avoid leaking timing
  const a = Buffer.from(pass);
  const b = Buffer.from(SITE_PASSWORD);
  const equal =
    a.length === b.length &&
    a.reduce((acc, c, i) => acc | (c ^ b[i] || 0), 0) === 0;

  if (!equal) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return issueGate(request);
}
