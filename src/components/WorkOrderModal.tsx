import { useEffect, useState } from "react";
import { X, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import logoImg from "@/assets/logo.png";

interface WorkOrderData {
  job: {
    id: string;
    job_number: string;
    service_order_number: number | null;
    description: string;
    received_at: string;
    estimated_completion_date: string | null;
    notes: string | null;
  };
  customer: { name: string; phone: string | null; };
  motorcycle: { registration: string; make: string; model: string; year: number | null; };
  services: { description: string; mechanic_name: string | null; service_type: string; }[];
  parts: { name: string; quantity: number; }[];
}

interface Props {
  data: WorkOrderData;
  onClose: () => void;
}

const WorkOrderModal = ({ data, onClose }: Props) => {
  const [workshop, setWorkshop] = useState({ name: "Two Wheels Motorcycles", phone: "", address: "" });

  useEffect(() => {
    const fetch = async () => {
      const { data: settings } = await supabase.from("workshop_settings").select("key, value");
      if (settings) {
        const map: Record<string, string> = {};
        settings.forEach((s: any) => { map[s.key] = s.value; });
        setWorkshop({
          name: map.workshop_name || "Two Wheels Motorcycles",
          phone: map.workshop_phone || "",
          address: map.workshop_address || "",
        });
      }
    };
    fetch();
  }, []);

  const soNumber = data.job.service_order_number
    ? `SO-${String(data.job.service_order_number).padStart(5, "0")}`
    : data.job.job_number;

  const getLogoBase64 = (): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => resolve("");
      img.src = logoImg;
    });
  };

  const handlePrint = async () => {
    const logoBase64 = await getLogoBase64();

    const serviceRows = data.services.map(s => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #ddd;font-size:13px">${s.description}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #ddd;font-size:13px;text-align:center">${s.mechanic_name || "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #ddd;font-size:13px;text-align:center">
          ${s.service_type === "extra" ? '<span style="background:#f59e0b;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px">Extra</span>' : "Standard"}
        </td>
      </tr>
    `).join("");

    const partRows = data.parts.map(p => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #ddd;font-size:13px">${p.name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #ddd;font-size:13px;text-align:center">${p.quantity}</td>
      </tr>
    `).join("");

    const html = `
      <html><head><meta charset="UTF-8"><title>Work Order ${soNumber}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Segoe UI',Arial,sans-serif; padding:40px; color:#1a1a1a; background:#fff; }
        @media print { body { padding:20px; } .no-print { display:none !important; } }
        @media (max-width:600px) { body { padding:16px; } }
        .sig-line { border-top:1px solid #333; margin-top:40px; padding-top:8px; width:45%; display:inline-block; text-align:center; font-size:12px; color:#666; }
      </style></head><body>

      <div class="no-print" style="text-align:center;margin-bottom:20px">
        <button onclick="window.print()" style="background:#e63946;color:white;border:none;padding:14px 40px;font-size:16px;font-weight:bold;border-radius:8px;cursor:pointer">
          🖨️ Print Work Order
        </button>
      </div>

      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;border-bottom:3px solid #e63946;padding-bottom:16px;flex-wrap:wrap;gap:12px">
        <div style="display:flex;align-items:center;gap:16px">
          ${logoBase64 ? `<img src="${logoBase64}" style="height:60px;width:auto;object-fit:contain" />` : ""}
          <div>
            <div style="font-size:22px;font-weight:bold;color:#e63946">${workshop.name}</div>
            ${workshop.address ? `<p style="font-size:12px;color:#666;margin-top:4px">${workshop.address}</p>` : ""}
            ${workshop.phone ? `<p style="font-size:12px;color:#666">Tel: ${workshop.phone}</p>` : ""}
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-size:18px;font-weight:bold">WORK ORDER</div>
          <p style="font-size:15px;font-weight:bold;color:#e63946">${soNumber}</p>
          <p style="font-size:13px;color:#666">Date: ${new Date().toLocaleDateString("en-GB")}</p>
        </div>
      </div>

      <!-- Customer & Vehicle -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
        <div style="background:#f8f8f8;padding:12px;border-radius:8px">
          <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#666;margin-bottom:6px">Customer</h3>
          <p style="font-size:14px;font-weight:bold">${data.customer.name}</p>
          ${data.customer.phone ? `<p style="font-size:12px;color:#666">Tel: ${data.customer.phone}</p>` : ""}
        </div>
        <div style="background:#f8f8f8;padding:12px;border-radius:8px">
          <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#666;margin-bottom:6px">Vehicle</h3>
          <p style="font-size:14px;font-weight:bold">${data.motorcycle.make} ${data.motorcycle.model}</p>
          <p style="font-size:12px;color:#666">Reg: ${data.motorcycle.registration}</p>
          ${data.motorcycle.year ? `<p style="font-size:12px;color:#666">Year: ${data.motorcycle.year}</p>` : ""}
        </div>
      </div>

      <!-- Customer Complaint -->
      <div style="margin-bottom:20px;padding:12px;background:#fafafa;border-radius:8px;border-left:3px solid #e63946">
        <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#666;margin-bottom:4px">Customer Complaint / Work Required</h3>
        <p style="font-size:13px">${data.job.description}</p>
      </div>

      ${data.job.estimated_completion_date ? `
        <p style="font-size:12px;color:#666;margin-bottom:16px">
          <strong>Estimated Completion:</strong> ${new Date(data.job.estimated_completion_date).toLocaleDateString("en-GB")}
        </p>
      ` : ""}

      <!-- Services -->
      ${data.services.length > 0 ? `
        <h3 style="font-size:13px;font-weight:bold;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px">Services</h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
          <thead>
            <tr>
              <th style="background:#1a1a1a;color:white;padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase">Service</th>
              <th style="background:#1a1a1a;color:white;padding:8px 12px;text-align:center;font-size:11px;text-transform:uppercase">Mechanic</th>
              <th style="background:#1a1a1a;color:white;padding:8px 12px;text-align:center;font-size:11px;text-transform:uppercase">Type</th>
            </tr>
          </thead>
          <tbody>${serviceRows}</tbody>
        </table>
      ` : ""}

      <!-- Parts -->
      ${data.parts.length > 0 ? `
        <h3 style="font-size:13px;font-weight:bold;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px">Parts Required</h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
          <thead>
            <tr>
              <th style="background:#1a1a1a;color:white;padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase">Part</th>
              <th style="background:#1a1a1a;color:white;padding:8px 12px;text-align:center;font-size:11px;text-transform:uppercase">Qty</th>
            </tr>
          </thead>
          <tbody>${partRows}</tbody>
        </table>
      ` : ""}

      <!-- Mechanic Notes -->
      <div style="margin-top:24px;border:1px solid #ddd;border-radius:8px;padding:16px;min-height:120px">
        <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#666;margin-bottom:8px">Mechanic Notes</h3>
        ${data.job.notes ? `<p style="font-size:12px;color:#333">${data.job.notes}</p>` : ""}
        <div style="min-height:80px"></div>
      </div>

      <!-- Signatures -->
      <div style="margin-top:60px;display:flex;justify-content:space-between">
        <div class="sig-line">Mechanic Signature</div>
        <div class="sig-line">Customer Signature</div>
      </div>

      <!-- Footer -->
      <div style="margin-top:40px;text-align:center;font-size:10px;color:#999;border-top:1px solid #eee;padding-top:12px">
        Internal Workshop Document — ${workshop.name}
      </div>

      </body></html>
    `;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl rounded-xl border border-border bg-card max-h-[95vh] overflow-y-auto">

        {/* Toolbar */}
        <div className="sticky top-0 z-10 border-b border-border bg-card px-4 sm:px-5 py-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-foreground">Work Order — {soNumber}</h2>
            <button onClick={onClose} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
          <button onClick={handlePrint}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 min-h-[44px] text-xs font-semibold text-primary-foreground hover:brightness-110 w-full">
            <Printer className="h-4 w-4" /> Print Work Order
          </button>
        </div>

        {/* Preview */}
        <div className="p-6" style={{ background: "#fff", color: "#1a1a1a", borderRadius: "0 0 12px 12px" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, borderBottom: "3px solid #e63946", paddingBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <img src={logoImg} alt="Logo" style={{ height: 50, width: "auto", objectFit: "contain" }} />
              <div>
                <div style={{ fontSize: 22, fontWeight: "bold", color: "#e63946" }}>{workshop.name}</div>
                {workshop.address && <p style={{ fontSize: 12, color: "#666", marginTop: 4 }}>{workshop.address}</p>}
                {workshop.phone && <p style={{ fontSize: 12, color: "#666" }}>Tel: {workshop.phone}</p>}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 18, fontWeight: "bold" }}>WORK ORDER</div>
              <p style={{ fontSize: 15, fontWeight: "bold", color: "#e63946" }}>{soNumber}</p>
              <p style={{ fontSize: 13, color: "#666" }}>Date: {new Date().toLocaleDateString("en-GB")}</p>
            </div>
          </div>

          {/* Customer & Vehicle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div style={{ background: "#f8f8f8", padding: 12, borderRadius: 8 }}>
              <h3 style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#666", marginBottom: 6 }}>Customer</h3>
              <p style={{ fontSize: 14, fontWeight: "bold" }}>{data.customer.name}</p>
              {data.customer.phone && <p style={{ fontSize: 12, color: "#666" }}>Tel: {data.customer.phone}</p>}
            </div>
            <div style={{ background: "#f8f8f8", padding: 12, borderRadius: 8 }}>
              <h3 style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#666", marginBottom: 6 }}>Vehicle</h3>
              <p style={{ fontSize: 14, fontWeight: "bold" }}>{data.motorcycle.make} {data.motorcycle.model}</p>
              <p style={{ fontSize: 12, color: "#666" }}>Reg: {data.motorcycle.registration}</p>
              {data.motorcycle.year && <p style={{ fontSize: 12, color: "#666" }}>Year: {data.motorcycle.year}</p>}
            </div>
          </div>

          {/* Complaint */}
          <div style={{ marginBottom: 20, padding: 12, background: "#fafafa", borderRadius: 8, borderLeft: "3px solid #e63946" }}>
            <h3 style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#666", marginBottom: 4 }}>Customer Complaint / Work Required</h3>
            <p style={{ fontSize: 13 }}>{data.job.description}</p>
          </div>

          {/* Services */}
          {data.services.length > 0 && (
            <>
              <h3 style={{ fontSize: 13, fontWeight: "bold", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Services</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20 }}>
                <thead>
                  <tr>
                    <th style={{ background: "#1a1a1a", color: "white", padding: "8px 12px", textAlign: "left", fontSize: 11, textTransform: "uppercase" }}>Service</th>
                    <th style={{ background: "#1a1a1a", color: "white", padding: "8px 12px", textAlign: "center", fontSize: 11, textTransform: "uppercase" }}>Mechanic</th>
                    <th style={{ background: "#1a1a1a", color: "white", padding: "8px 12px", textAlign: "center", fontSize: 11, textTransform: "uppercase" }}>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {data.services.map((s, i) => (
                    <tr key={i}>
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid #ddd", fontSize: 13 }}>{s.description}</td>
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid #ddd", fontSize: 13, textAlign: "center" }}>{s.mechanic_name || "—"}</td>
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid #ddd", fontSize: 13, textAlign: "center" }}>
                        {s.service_type === "extra" ? (
                          <span style={{ background: "#f59e0b", color: "#fff", padding: "2px 8px", borderRadius: 4, fontSize: 11 }}>Extra</span>
                        ) : "Standard"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Parts */}
          {data.parts.length > 0 && (
            <>
              <h3 style={{ fontSize: 13, fontWeight: "bold", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Parts Required</h3>
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20 }}>
                <thead>
                  <tr>
                    <th style={{ background: "#1a1a1a", color: "white", padding: "8px 12px", textAlign: "left", fontSize: 11, textTransform: "uppercase" }}>Part</th>
                    <th style={{ background: "#1a1a1a", color: "white", padding: "8px 12px", textAlign: "center", fontSize: 11, textTransform: "uppercase" }}>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {data.parts.map((p, i) => (
                    <tr key={i}>
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid #ddd", fontSize: 13 }}>{p.name}</td>
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid #ddd", fontSize: 13, textAlign: "center" }}>{p.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Mechanic Notes */}
          <div style={{ marginTop: 24, border: "1px solid #ddd", borderRadius: 8, padding: 16, minHeight: 100 }}>
            <h3 style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#666", marginBottom: 8 }}>Mechanic Notes</h3>
            {data.job.notes && <p style={{ fontSize: 12, color: "#333" }}>{data.job.notes}</p>}
          </div>

          {/* Signatures */}
          <div style={{ marginTop: 48, display: "flex", justifyContent: "space-between" }}>
            <div style={{ borderTop: "1px solid #333", paddingTop: 8, width: "45%", textAlign: "center", fontSize: 12, color: "#666" }}>Mechanic Signature</div>
            <div style={{ borderTop: "1px solid #333", paddingTop: 8, width: "45%", textAlign: "center", fontSize: 12, color: "#666" }}>Customer Signature</div>
          </div>

          <div style={{ marginTop: 40, textAlign: "center", fontSize: 10, color: "#999", borderTop: "1px solid #eee", paddingTop: 12 }}>
            Internal Workshop Document — {workshop.name}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default WorkOrderModal;
