import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, message_id, customer_id, phone_number, message_body, template_id, campaign_id, trigger_type, document_url, document_filename, caption } = await req.json();

    // Send a single message
    if (action === "send") {
      if (!phone_number || !customer_id) {
        return new Response(JSON.stringify({ error: "Missing required fields: phone_number, customer_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
      const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

      // Log message in DB first
      const { data: msg, error: insertError } = await supabase.from("whatsapp_messages").insert({
        customer_id,
        phone_number,
        message_body: message_body || caption || "Invoice PDF",
        template_id: template_id || null,
        campaign_id: campaign_id || null,
        trigger_type: trigger_type || "manual",
        status: "pending",
      }).select().single();

      if (insertError) {
        console.error("Insert error:", insertError);
        return new Response(JSON.stringify({ error: "Failed to log message" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // If WhatsApp credentials not configured, mark as queued
      if (!accessToken || !phoneNumberId) {
        await supabase.from("whatsapp_messages").update({ status: "queued" }).eq("id", msg.id);
        return new Response(JSON.stringify({ 
          success: true, 
          message_id: msg.id, 
          status: "queued",
          note: "WhatsApp credentials not configured yet. Message queued for sending."
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Send via WhatsApp Cloud API
      try {
        let waBody: Record<string, unknown>;

        if (document_url) {
          // Send as document (PDF)
          waBody = {
            messaging_product: "whatsapp",
            to: phone_number.replace(/[^0-9]/g, ""),
            type: "document",
            document: {
              link: document_url,
              filename: document_filename || "invoice.pdf",
              caption: caption || "",
            },
          };
        } else {
          // Send as text
          waBody = {
            messaging_product: "whatsapp",
            to: phone_number.replace(/[^0-9]/g, ""),
            type: "text",
            text: { body: message_body },
          };
        }

        const waResponse = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(waBody),
        });

        const waData = await waResponse.json();

        if (waResponse.ok && waData.messages?.[0]?.id) {
          await supabase.from("whatsapp_messages").update({
            status: "sent",
            sent_at: new Date().toISOString(),
            whatsapp_message_id: waData.messages[0].id,
          }).eq("id", msg.id);

          return new Response(JSON.stringify({ success: true, message_id: msg.id, status: "sent", wa_id: waData.messages[0].id }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } else {
          const errorMsg = waData.error?.message || "Unknown WhatsApp error";
          await supabase.from("whatsapp_messages").update({
            status: "failed",
            error_message: errorMsg,
          }).eq("id", msg.id);

          return new Response(JSON.stringify({ success: false, message_id: msg.id, status: "failed", error: errorMsg }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (waErr) {
        const errMsg = waErr instanceof Error ? waErr.message : "Network error";
        await supabase.from("whatsapp_messages").update({ status: "failed", error_message: errMsg }).eq("id", msg.id);
        return new Response(JSON.stringify({ success: false, message_id: msg.id, error: errMsg }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Update message status (for webhooks)
    if (action === "update_status") {
      if (!message_id) {
        return new Response(JSON.stringify({ error: "Missing message_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const updates: Record<string, string> = {};
      const { status: newStatus } = await req.json();
      if (newStatus === "delivered") updates.delivered_at = new Date().toISOString();
      if (newStatus === "read") updates.read_at = new Date().toISOString();
      updates.status = newStatus;

      await supabase.from("whatsapp_messages").update(updates).eq("whatsapp_message_id", message_id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use 'send' or 'update_status'" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("whatsapp-send error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
