import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ status: "application-api-ready" });
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Application storage is not configured." }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid application request." }, { status: 400 });
  }

  const { full_name, email, phone, birthdate, school, residence, data } = body;

  if (!full_name || !email || !phone || !birthdate || !school || !residence || !data) {
    return NextResponse.json({ error: "Missing required application fields." }, { status: 400 });
  }

  let supabaseProjectUrl: string;
  try {
    supabaseProjectUrl = new URL(supabaseUrl).origin;
  } catch {
    return NextResponse.json({ error: "Application storage is misconfigured." }, { status: 500 });
  }

  const supabase = createClient(supabaseProjectUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error } = await supabase.from("applications").insert({
    full_name,
    email,
    phone,
    birthdate,
    school,
    residence,
    data,
  });

  if (error) {
    console.error("Supabase application insert failed", error);
    return NextResponse.json({ error: "Could not save application." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
