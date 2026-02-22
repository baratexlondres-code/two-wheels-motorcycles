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
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (!image.startsWith("data:image/")) {
      return new Response(JSON.stringify({ error: "Invalid image format" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (image.length < 5000) {
      return new Response(JSON.stringify({ error: "Image too small or corrupt" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Processing product image, data URL length:", image.length);

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
                text: `You are a product identification system for a motorcycle parts and accessories shop. Analyze this image and extract product information.

INSTRUCTIONS:
- Look for barcodes, QR codes, product labels, packaging text, or any identifying information
- If you see a barcode or QR code, decode it and provide the number/data
- If you see product text/labels, extract the product name, brand, and any other details
- Try to identify the type of motorcycle part or accessory (e.g., oil filter, brake pads, chain, helmet, etc.)
- Estimate a category from: General, Engine Parts, Brakes, Electrical, Tyres, Suspension, Body Parts, Oils & Fluids, Filters, Chains & Sprockets, Accessories

Return ONLY a valid JSON object with these fields:
- product_name: the product name/description (string or null)
- barcode: barcode/QR code number if visible (string or null)
- brand: manufacturer/brand if visible (string or null)
- category: best matching category from the list above (string, default "General")
- sku: any SKU/part number visible (string or null)
- confidence: "high", "medium" or "low"
- details: any additional details like size, color, specifications (string or null)

Return ONLY the JSON object, no markdown, no code fences, no other text.`
              },
              { type: "image_url", image_url: { url: image } }
            ]
          }
        ],
        max_tokens: 300,
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

    let result;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : { product_name: null, confidence: "low" };
    } catch {
      result = { product_name: null, confidence: "low" };
    }

    // Clean up empty strings
    for (const key of ["product_name", "barcode", "brand", "sku", "details"]) {
      if (result[key] === "" || result[key] === "null") result[key] = null;
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("product-scanner error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
