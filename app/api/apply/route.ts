import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Application storage is not configured." }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const body = await request.json();
  const { full_name, email, phone, birthdate, school, residence, data } = body;

  if (!full_name || !email || !phone || !birthdate || !school || !residence || !data) {
    return NextResponse.json({ error: "Missing required application fields." }, { status: 400 });
  }

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
