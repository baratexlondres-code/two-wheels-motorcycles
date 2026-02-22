import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

interface Motorcycle {
  id: string;
  customer_id: string;
  make: string;
  model: string;
  registration: string;
  mot_expiry_date: string | null;
  last_service_date: string | null;
  last_service_type: string | null;
}

function replaceVariables(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value || "");
  }
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, campaign_id } = await req.json();

    // Fetch settings
    const { data: settingsRows } = await supabase.from("whatsapp_settings").select("*");
    const settings: Record<string, string> = {};
    settingsRows?.forEach((r: any) => { settings[r.key] = r.value; });

    const maxPromoPerWeek = parseInt(settings.max_promo_per_week || "1");
    const maxMsgPerMonth = parseInt(settings.max_messages_per_month || "2");
    const highValueThreshold = parseInt(settings.high_value_threshold || "500");

    // Check message frequency for a customer
    async function canSendTo(customerId: string, isUrgent: boolean): Promise<boolean> {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Count promo messages this week
      const { count: weekCount } = await supabase
        .from("whatsapp_messages")
        .select("*", { count: "exact", head: true })
        .eq("customer_id", customerId)
        .in("trigger_type", ["promotion", "campaign", "high_value", "pass_by"])
        .gte("created_at", weekAgo);

      if ((weekCount || 0) >= maxPromoPerWeek && !isUrgent) return false;

      // Count all messages this month
      const { count: monthCount } = await supabase
        .from("whatsapp_messages")
        .select("*", { count: "exact", head: true })
        .eq("customer_id", customerId)
        .gte("created_at", monthAgo);

      if ((monthCount || 0) >= maxMsgPerMonth && !isUrgent) return false;

      return true;
    }

    // Send message helper
    async function sendMessage(customerId: string, phone: string, body: string, triggerType: string, templateId?: string, campaignId?: string) {
      const sendUrl = `${supabaseUrl}/functions/v1/whatsapp-send`;
      await fetch(sendUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          action: "send",
          customer_id: customerId,
          phone_number: phone,
          message_body: body,
          trigger_type: triggerType,
          template_id: templateId,
          campaign_id: campaignId,
        }),
      });
    }

    // ACTION: Run all automated triggers
    if (action === "run_triggers") {
      const results: Record<string, number> = { mot_30: 0, mot_7: 0, oil_change: 0, inactive_6m: 0, inactive_12m: 0 };

      // Get all customers with phone
      const { data: customers } = await supabase.from("customers").select("id, name, phone").not("phone", "is", null);
      if (!customers?.length) {
        return new Response(JSON.stringify({ message: "No customers with phone numbers", results }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get motorcycles
      const { data: motorcycles } = await supabase.from("motorcycles").select("*");

      // Get templates
      const { data: templates } = await supabase.from("whatsapp_templates").select("*").eq("active", true);
      const templateMap: Record<string, any> = {};
      templates?.forEach((t: any) => { templateMap[t.category] = t; });

      const now = new Date();
      const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      const twelveMonthsAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

      for (const customer of customers as Customer[]) {
        if (!customer.phone) continue;

        const customerBikes = (motorcycles as Motorcycle[])?.filter(m => m.customer_id === customer.id) || [];
        const firstName = customer.name.split(" ")[0];

        for (const bike of customerBikes) {
          const vars = {
            FirstName: firstName,
            FullName: customer.name,
            VehicleModel: `${bike.make} ${bike.model}`,
            LicensePlate: bike.registration,
          };

          // MOT 30 days
          if (bike.mot_expiry_date) {
            const motDate = new Date(bike.mot_expiry_date);
            if (motDate <= in30d && motDate > in7d) {
              const canSend = await canSendTo(customer.id, true);
              if (canSend && templateMap["mot_reminder_30"]) {
                const body = replaceVariables(templateMap["mot_reminder_30"].message_body, vars);
                await sendMessage(customer.id, customer.phone, body, "mot_reminder", templateMap["mot_reminder_30"].id);
                results.mot_30++;
              }
            }
            // MOT 7 days
            if (motDate <= in7d && motDate > now) {
              const canSend = await canSendTo(customer.id, true);
              if (canSend && templateMap["mot_reminder_7"]) {
                const body = replaceVariables(templateMap["mot_reminder_7"].message_body, vars);
                await sendMessage(customer.id, customer.phone, body, "mot_reminder_urgent", templateMap["mot_reminder_7"].id);
                results.mot_7++;
              }
            }
          }

          // Oil change (6 months since last service)
          if (bike.last_service_date) {
            const lastService = new Date(bike.last_service_date);
            if (lastService <= sixMonthsAgo) {
              const canSend = await canSendTo(customer.id, false);
              if (canSend && templateMap["oil_change"]) {
                const body = replaceVariables(templateMap["oil_change"].message_body, vars);
                await sendMessage(customer.id, customer.phone, body, "oil_change", templateMap["oil_change"].id);
                results.oil_change++;
              }
            }
          }
        }

        // Inactive customer checks (based on repair jobs)
        const { data: lastRepair } = await supabase
          .from("repair_jobs")
          .select("created_at")
          .eq("customer_id", customer.id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (lastRepair?.length) {
          const lastVisit = new Date(lastRepair[0].created_at);
          const bike = customerBikes[0];
          const vars = {
            FirstName: firstName,
            FullName: customer.name,
            VehicleModel: bike ? `${bike.make} ${bike.model}` : "vehicle",
            LicensePlate: bike?.registration || "",
          };

          if (lastVisit <= twelveMonthsAgo) {
            const canSend = await canSendTo(customer.id, false);
            if (canSend && templateMap["inactive_12m"]) {
              const body = replaceVariables(templateMap["inactive_12m"].message_body, vars);
              await sendMessage(customer.id, customer.phone, body, "inactive_reactivation", templateMap["inactive_12m"].id);
              results.inactive_12m++;
            }
          } else if (lastVisit <= sixMonthsAgo) {
            const canSend = await canSendTo(customer.id, false);
            if (canSend && templateMap["inactive_6m"]) {
              const body = replaceVariables(templateMap["inactive_6m"].message_body, vars);
              await sendMessage(customer.id, customer.phone, body, "inactive_reactivation", templateMap["inactive_6m"].id);
              results.inactive_6m++;
            }
          }
        }
      }

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: Run weekly promotion
    if (action === "run_promotion") {

      // Get promotion templates
      const { data: promoTemplates } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .eq("active", true)
        .in("category", ["promotion_free_check", "promotion_oil", "promotion_brake", "pass_by", "seasonal"]);

      if (!promoTemplates?.length) {
        return new Response(JSON.stringify({ error: "No promotion templates found" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check which templates were used in last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentMessages } = await supabase
        .from("whatsapp_messages")
        .select("template_id")
        .in("trigger_type", ["promotion", "campaign"])
        .gte("created_at", thirtyDaysAgo);

      const recentTemplateIds = new Set(recentMessages?.map((m: any) => m.template_id) || []);
      const availableTemplates = promoTemplates.filter((t: any) => !recentTemplateIds.has(t.id));
      const template = availableTemplates.length > 0
        ? availableTemplates[Math.floor(Math.random() * availableTemplates.length)]
        : promoTemplates[Math.floor(Math.random() * promoTemplates.length)];

      // Get customers
      const { data: customers } = await supabase.from("customers").select("id, name, phone").not("phone", "is", null);
      let sent = 0;

      for (const customer of (customers || []) as Customer[]) {
        if (!customer.phone) continue;
        const canSend = await canSendTo(customer.id, false);
        if (!canSend) continue;

        // Get first motorcycle
        const { data: bikes } = await supabase.from("motorcycles").select("make, model").eq("customer_id", customer.id).limit(1);
        const bike = bikes?.[0];

        const vars = {
          FirstName: customer.name.split(" ")[0],
          FullName: customer.name,
          VehicleModel: bike ? `${bike.make} ${bike.model}` : "vehicle",
          LicensePlate: "",
        };

        const body = replaceVariables(template.message_body, vars);
        await sendMessage(customer.id, customer.phone, body, "promotion", template.id, campaign_id);
        sent++;
      }

      // Update campaign stats
      if (campaign_id) {
        await supabase.from("whatsapp_campaigns").update({
          total_recipients: sent,
          total_sent: sent,
          sent_at: new Date().toISOString(),
          status: "sent",
        }).eq("id", campaign_id);
      }

      return new Response(JSON.stringify({ success: true, sent, template_used: template.name }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: Get automation stats
    if (action === "stats") {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const { count: totalSent } = await supabase
        .from("whatsapp_messages")
        .select("*", { count: "exact", head: true })
        .gte("created_at", thirtyDaysAgo);

      const { count: delivered } = await supabase
        .from("whatsapp_messages")
        .select("*", { count: "exact", head: true })
        .eq("status", "delivered")
        .gte("created_at", thirtyDaysAgo);

      const { count: read } = await supabase
        .from("whatsapp_messages")
        .select("*", { count: "exact", head: true })
        .eq("status", "read")
        .gte("created_at", thirtyDaysAgo);

      const { count: failed } = await supabase
        .from("whatsapp_messages")
        .select("*", { count: "exact", head: true })
        .eq("status", "failed")
        .gte("created_at", thirtyDaysAgo);

      return new Response(JSON.stringify({ 
        total_sent: totalSent || 0,
        delivered: delivered || 0,
        read: read || 0,
        failed: failed || 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use: run_triggers, run_promotion, stats" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("whatsapp-automation error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
