import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ status: "partner-api-ready" });
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Partner storage is not configured." }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid partner request." }, { status: 400 });
  }

  const { company_name, contact_name, job_title, email, phone, website, data } = body;

  if (!company_name || !contact_name || !job_title || !email || !phone || !website || !data) {
    return NextResponse.json({ error: "Missing required partner fields." }, { status: 400 });
  }

  let supabaseProjectUrl: string;
  try {
    supabaseProjectUrl = new URL(supabaseUrl).origin;
  } catch {
    return NextResponse.json({ error: "Partner storage is misconfigured." }, { status: 500 });
  }

  const supabase = createClient(supabaseProjectUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error } = await supabase.from("partner_applications").insert({
    company_name,
    contact_name,
    job_title,
    email,
    phone,
    website,
    data,
  });

  if (error) {
    console.error("Supabase partner insert failed", error);
    return NextResponse.json({ error: "Could not save partner application." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
