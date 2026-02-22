import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { image } = await req.json();
    if (!image) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Validate data URL format
    if (!image.startsWith("data:image/")) {
      console.error("Not a valid image data URL");
      return new Response(JSON.stringify({ error: "Invalid image format" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Check minimum size
    if (image.length < 5000) {
      console.error("Image data too small:", image.length);
      return new Response(JSON.stringify({ error: "Image too small or corrupt" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    console.log("Processing image, data URL length:", image.length);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { 
                type: "text", 
                text: `You are a vehicle license plate OCR system. Extract the license plate number from this image.

INSTRUCTIONS:
- Look carefully at the entire image for any visible license plate
- The plate may be at any angle or partially obscured
- Support all plate formats (Brazilian like ABC1D23 or ABC-1234, Portuguese like AA-00-AA, UK, EU, etc.)
- If you can see ANY characters on a plate, report them even with low confidence
- Return ONLY a valid JSON object with these fields:
  - registration: the plate number in uppercase (e.g. "ABC1D23") or null if truly unreadable
  - confidence: "high", "medium" or "low"
  - make: vehicle make/brand if visible or null
  - model: vehicle model if visible or null
  - color: vehicle color if visible or null

Return ONLY the JSON object, no markdown, no code fences, no other text.` 
              },
              { type: "image_url", image_url: { url: image } }
            ]
          }
        ],
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI processing failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    console.log("AI response content:", content);

    // Try to parse JSON from the response
    let result;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : { registration: null, confidence: "low" };
    } catch {
      result = { registration: null, confidence: "low" };
    }

    // Ensure registration is not empty string
    if (result.registration === "" || result.registration === "null") {
      result.registration = null;
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("plate-scanner error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
