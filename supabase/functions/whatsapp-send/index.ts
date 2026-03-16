// WhatsApp Send Edge Function v3 — with UK phone formatting
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function formatUKNumber(phone: string | null): string | null {
  if (!phone) return null;
  phone = phone.replace(/\s+/g, "").replace(/[^0-9+]/g, "");
  if (phone.startsWith("07")) return "44" + phone.slice(1);
  if (phone.startsWith("+44")) return phone.slice(1);
  if (phone.startsWith("+")) return phone.slice(1);
  return phone;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { action, message_id, customer_id, phone_number, message_body, template_id, campaign_id, trigger_type, document_url, document_filename, caption } = body;

    // ─── Send a single message ──────────────────────────────
    if (action === "send") {
      if (!phone_number || !customer_id) {
        return new Response(JSON.stringify({ error: "Missing required fields: phone_number, customer_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
      const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
      const formattedPhone = formatUKNumber(phone_number) || phone_number.replace(/[^0-9]/g, "");

      // Log message in DB
      const { data: msg, error: insertError } = await supabase.from("whatsapp_messages").insert({
        customer_id,
        phone_number: formattedPhone,
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

      if (!accessToken || !phoneNumberId) {
        await supabase.from("whatsapp_messages").update({ status: "queued" }).eq("id", msg.id);
        return new Response(JSON.stringify({ success: true, message_id: msg.id, status: "queued", note: "WhatsApp credentials not configured. Message queued." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Send via WhatsApp Cloud API
      try {
        let waBody: Record<string, unknown>;
        if (document_url) {
          waBody = {
            messaging_product: "whatsapp",
            to: formattedPhone,
            type: "document",
            document: { link: document_url, filename: document_filename || "invoice.pdf", caption: caption || "" },
          };
        } else {
          waBody = {
            messaging_product: "whatsapp",
            to: formattedPhone,
            type: "text",
            text: { body: message_body },
          };
        }

        const waResponse = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(waBody),
        });
        const waData = await waResponse.json();

        if (waResponse.ok && waData.messages?.[0]?.id) {
          await supabase.from("whatsapp_messages").update({
            status: "sent", sent_at: new Date().toISOString(), whatsapp_message_id: waData.messages[0].id,
          }).eq("id", msg.id);
          return new Response(JSON.stringify({ success: true, message_id: msg.id, status: "sent", wa_id: waData.messages[0].id }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } else {
          const errorMsg = waData.error?.message || "Unknown WhatsApp error";
          await supabase.from("whatsapp_messages").update({ status: "failed", error_message: errorMsg }).eq("id", msg.id);
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

    // ─── Send campaign to multiple customers ────────────────
    if (action === "send_campaign") {
      const { customer_ids, message_text, campaign_name } = body;
      if (!customer_ids?.length || !message_text) {
        return new Response(JSON.stringify({ error: "Missing customer_ids or message_text" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
      const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

      // Create campaign record
      const { data: camp } = await supabase.from("whatsapp_campaigns").insert({
        name: campaign_name || `Campaign - ${new Date().toISOString().split("T")[0]}`,
        campaign_type: "manual",
        status: "sending",
        total_recipients: customer_ids.length,
      }).select().single();

      // Fetch customers
      const { data: customers } = await supabase.from("customers").select("id, name, phone").in("id", customer_ids);

      let sent = 0, failed = 0;
      const results: { customer_id: string; status: string; error?: string }[] = [];

      for (const cust of (customers || [])) {
        if (!cust.phone) {
          results.push({ customer_id: cust.id, status: "skipped", error: "No phone number" });
          failed++;
          continue;
        }

        const formattedPhone = formatUKNumber(cust.phone) || cust.phone.replace(/[^0-9]/g, "");
        const personalMsg = message_text
          .replace(/\{\{FirstName\}\}/g, cust.name?.split(" ")[0] || "")
          .replace(/\{\{FullName\}\}/g, cust.name || "");

        // Insert message record
        const { data: msg } = await supabase.from("whatsapp_messages").insert({
          customer_id: cust.id,
          phone_number: formattedPhone,
          message_body: personalMsg,
          campaign_id: camp?.id || null,
          trigger_type: "campaign",
          status: "pending",
        }).select().single();

        if (!accessToken || !phoneNumberId) {
          await supabase.from("whatsapp_messages").update({ status: "queued" }).eq("id", msg?.id);
          results.push({ customer_id: cust.id, status: "queued" });
          sent++;
          continue;
        }

        try {
          const waResponse = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: formattedPhone,
              type: "text",
              text: { body: personalMsg },
            }),
          });
          const waData = await waResponse.json();

          if (waResponse.ok && waData.messages?.[0]?.id) {
            await supabase.from("whatsapp_messages").update({
              status: "sent", sent_at: new Date().toISOString(), whatsapp_message_id: waData.messages[0].id,
            }).eq("id", msg?.id);
            results.push({ customer_id: cust.id, status: "sent" });
            sent++;
          } else {
            const errMsg = waData.error?.message || "WhatsApp error";
            await supabase.from("whatsapp_messages").update({ status: "failed", error_message: errMsg }).eq("id", msg?.id);
            results.push({ customer_id: cust.id, status: "failed", error: errMsg });
            failed++;
          }
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : "Network error";
          await supabase.from("whatsapp_messages").update({ status: "failed", error_message: errMsg }).eq("id", msg?.id);
          results.push({ customer_id: cust.id, status: "failed", error: errMsg });
          failed++;
        }
      }

      // Update campaign
      if (camp?.id) {
        await supabase.from("whatsapp_campaigns").update({
          status: "sent", sent_at: new Date().toISOString(), total_sent: sent,
        }).eq("id", camp.id);
      }

      return new Response(JSON.stringify({ success: true, sent, failed, total: customer_ids.length, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Update message status (webhooks) ───────────────────
    if (action === "update_status") {
      if (!message_id) {
        return new Response(JSON.stringify({ error: "Missing message_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const updates: Record<string, string> = {};
      const newStatus = body.status;
      if (newStatus === "delivered") updates.delivered_at = new Date().toISOString();
      if (newStatus === "read") updates.read_at = new Date().toISOString();
      updates.status = newStatus;

      await supabase.from("whatsapp_messages").update(updates).eq("whatsapp_message_id", message_id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use 'send', 'send_campaign', or 'update_status'" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("whatsapp-send error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
