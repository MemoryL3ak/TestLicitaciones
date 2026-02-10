import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function sanitizeFilePath(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 _.%\-]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const queryFilePath = url.searchParams.get("filePath") || "";

    const contentType = req.headers.get("content-type") || "";
    let filePath = "";
    let bytes: Uint8Array | null = null;

    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => null);
      filePath = (body?.filePath ?? "").toString();
      const pdfBase64 = (body?.pdfBase64 ?? "").toString();
      if (pdfBase64) {
        bytes = base64ToBytes(pdfBase64);
      }
    } else {
      const arrayBuffer = await req.arrayBuffer();
      if (arrayBuffer && arrayBuffer.byteLength > 0) {
        bytes = new Uint8Array(arrayBuffer);
      }
      filePath = queryFilePath;
    }

    filePath = sanitizeFilePath(filePath || queryFilePath || "");

    if (!filePath) {
      return new Response(
        JSON.stringify({ error: "filePath es requerido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!bytes || bytes.byteLength === 0) {
      return new Response(
        JSON.stringify({ error: "PDF vacio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Faltan variables SUPABASE_URL o SERVICE_ROLE_KEY" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const removeRes = await supabase.storage.from("fichas").remove([filePath]);

    const { error } = await supabase.storage
      .from("fichas")
      .upload(filePath, bytes, {
        contentType: "application/pdf",
        cacheControl: "0",
        upsert: true,
      });

    if (error) {
      return new Response(
        JSON.stringify({
          error: "upload_failed",
          message: error.message,
          statusCode: (error as any).statusCode ?? null,
          filePath,
          removed: removeRes?.data ?? null,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ ok: true, filePath }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "exception", message: e?.message || "Error interno" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
