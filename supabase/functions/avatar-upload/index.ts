import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Image } from "https://deno.land/x/imagescript@1.2.15/mod.ts";

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase environment variables" }),
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return new Response(JSON.stringify({ error: "No file uploaded" }), {
        status: 400,
      });
    }

    const arrayBuffer = await file.arrayBuffer();
    let image = await Image.decode(new Uint8Array(arrayBuffer));

    image = image.resize(256, 256);

    const compressed = await image.encodeWebp(80);

    const rawUserId = req.headers.get("x-user-id") || "";
    const sanitizedUserId = rawUserId.replace(/[^a-zA-Z0-9_-]/g, "");
    const prefix = sanitizedUserId ? `${sanitizedUserId}/` : "";

    const filename = `${prefix}${Date.now()}.webp`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filename, compressed, {
        contentType: "image/webp",
        upsert: true,
      });

    if (uploadError) {
      return new Response(JSON.stringify({ error: uploadError.message }), {
        status: 400,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        path: filename,
      }),
      { status: 200 }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
});

