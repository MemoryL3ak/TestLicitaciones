// supabase/functions/crear-usuario/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    // Validar método
    if (req.method !== "POST") {
      return new Response("Método no permitido", { status: 405 });
    }

    // Validar Bearer token (Service Key)
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    if (!token || token.length < 20) {
      return new Response("Unauthorized: Missing or invalid token", {
        status: 401,
      });
    }

    // Crear cliente con SERVICE ROLE KEY
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      token, // service_role_key pasada desde React
      {
        auth: { autoRefreshToken: false, persistSession: false }
      }
    );

    // Leer el JSON que viene desde React
    const { email, password, nombre, rol } = await req.json();

    if (!email || !password || !nombre || !rol) {
      return new Response("Faltan campos obligatorios", { status: 400 });
    }

    // 1) Crear usuario en Auth
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (userError) {
      return new Response(JSON.stringify(userError), { status: 400 });
    }

    const userId = userData.user.id;

    // 2) Crear perfil
    const { error: profileError } = await supabase.from("profiles").insert({
      id: userId,
      email,
      nombre,
      rol
    });

    if (profileError) {
      return new Response(JSON.stringify(profileError), { status: 400 });
    }

    return new Response(
      JSON.stringify({ message: "Usuario creado correctamente" }),
      { status: 200 }
    );

  } catch (err) {
    console.error(err);
    return new Response("Internal Server Error", { status: 500 });
  }
});
