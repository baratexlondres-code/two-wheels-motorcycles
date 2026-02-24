import { useEffect, useRef, useState } from "react";
import { X, Printer, Mail, MessageCircle, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import logoImg from "@/assets/logo.png";

interface InvoiceData {
  job: {
    id: string;
    job_number: string;
    description: string;
    estimated_cost: number | null;
    final_cost: number | null;
    labor_cost: number | null;
    invoice_number: string | null;
    payment_status: string;
    received_at: string;
    completed_at: string | null;
  };
  customer: { name: string; phone: string | null; email: string | null; address: string | null };
  motorcycle: { registration: string; make: string; model: string; year: number | null };
  parts: { name: string; quantity: number; unit_price: number }[];
  services?: { description: string; price: number }[];
}

interface Props {
  data: InvoiceData;
  onClose: () => void;
  onPaid: () => void;
}

const InvoiceModal = ({ data, onClose, onPaid }: Props) => {
  const [workshop, setWorkshop] = useState({ name: "Two Wheels Motorcycles", phone: "", email: "", address: "", vat_rate: "20", currency: "£" });
  // Labour: use labor_cost, or fallback to final_cost/estimated_cost if no parts/services exist
  const computeInitialLabor = () => {
    if (data.job.labor_cost != null && data.job.labor_cost > 0) return data.job.labor_cost;
    // If there are no parts and no services, use final_cost or estimated_cost as labor
    const hasParts = data.parts.length > 0;
    const hasServices = (data.services || []).length > 0;
    if (!hasParts && !hasServices) {
      if (data.job.final_cost != null && data.job.final_cost > 0) return data.job.final_cost;
      if (data.job.estimated_cost != null && data.job.estimated_cost > 0) return data.job.estimated_cost;
    }
    return 0;
  };
  const [laborCost, setLaborCost] = useState(String(computeInitialLabor()));
  const [saving, setSaving] = useState(false);
  const [includeVat, setIncludeVat] = useState(true);

  // Editable customer & vehicle fields (pre-filled from data, manually editable)
  const [custName, setCustName] = useState(data.customer.name || "");
  const [custPhone, setCustPhone] = useState(data.customer.phone || "");
  const [custEmail, setCustEmail] = useState(data.customer.email || "");
  const [custAddress, setCustAddress] = useState(data.customer.address || "");
  const [motoMake, setMotoMake] = useState(data.motorcycle.make || "");
  const [motoModel, setMotoModel] = useState(data.motorcycle.model || "");
  const [motoReg, setMotoReg] = useState(data.motorcycle.registration || "");
  const [motoYear, setMotoYear] = useState(String(data.motorcycle.year || ""));
  const [description, setDescription] = useState(data.job.description || "");

  useEffect(() => {
    const fetchSettings = async () => {
      const { data: settings } = await supabase.from("workshop_settings").select("key, value");
      if (settings) {
        const map: Record<string, string> = {};
        settings.forEach((s: any) => { map[s.key] = s.value; });
        setWorkshop({
          name: map.workshop_name || "Two Wheels Motorcycles",
          phone: map.workshop_phone || "",
          email: map.workshop_email || "",
          address: map.workshop_address || "",
          vat_rate: map.vat_rate || "20",
          currency: map.currency || "£",
        });
      }
    };
    fetchSettings();
  }, []);

  const cur = workshop.currency;
  const vatRate = parseFloat(workshop.vat_rate) / 100;
  const partsTotal = data.parts.reduce((sum, p) => sum + p.quantity * p.unit_price, 0);
  const servicesTotal = (data.services || []).reduce((sum, s) => sum + s.price, 0);
  const labor = parseFloat(laborCost) || 0;
  
  // Subtotal = parts + services + labor
  const subtotal = partsTotal + servicesTotal + labor;
  
  // VAT only when includeVat is ON
  const vat = includeVat ? subtotal * vatRate : 0;
  
  // Total = subtotal + VAT (or just subtotal when VAT is OFF)
  const displayTotal = subtotal + vat;

  const handleSaveLaborCost = async () => {
    await supabase.from("repair_jobs").update({ labor_cost: labor, final_cost: displayTotal }).eq("id", data.job.id);
  };

  const handleMarkPaid = async () => {
    setSaving(true);
    await supabase.from("repair_jobs").update({
      payment_status: "paid",
      payment_date: new Date().toISOString(),
      final_cost: displayTotal,
      labor_cost: labor,
    }).eq("id", data.job.id);
    setSaving(false);
    onPaid();
  };

  // Convert logo to base64 for print window
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

  const buildInvoiceHTML = async (withVat: boolean, opts?: { showPrintBtn?: boolean; showEmailLink?: boolean }) => {
    const logoBase64 = await getLogoBase64();
    const invoiceNum = data.job.invoice_number || data.job.job_number;

    // Calculate totals based on VAT toggle for the HTML
    const htmlVat = withVat ? subtotal * vatRate : 0;
    const htmlTotal = subtotal + htmlVat;

    const partsRows = data.parts.map(p => {
      return `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px">${p.name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;text-align:center">${p.quantity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;text-align:right">${cur}${p.unit_price.toFixed(2)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;text-align:right">${cur}${(p.quantity * p.unit_price).toFixed(2)}</td>
      </tr>
    `}).join("");

    const serviceRows = (data.services || []).map(s => {
      return `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px">${s.description}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;text-align:center">1</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;text-align:right">${cur}${s.price.toFixed(2)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;text-align:right">${cur}${s.price.toFixed(2)}</td>
      </tr>
    `}).join("");

    const allRows = partsRows + serviceRows;
    const hasItems = data.parts.length > 0 || (data.services || []).length > 0;

    const totalsSection = withVat ? `
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px"><span>Parts</span><span>${cur}${partsTotal.toFixed(2)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px"><span>Services</span><span>${cur}${servicesTotal.toFixed(2)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px"><span>Labour</span><span>${cur}${labor.toFixed(2)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;border-top:1px solid #eee;margin-top:4px"><span>Subtotal</span><span>${cur}${subtotal.toFixed(2)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;color:#666"><span>VAT (${workshop.vat_rate}%)</span><span>${cur}${htmlVat.toFixed(2)}</span></div>
      <div style="display:flex;justify-content:space-between;padding-top:10px;margin-top:4px;border-top:2px solid #1a1a1a;font-weight:bold;font-size:18px"><span>TOTAL</span><span>${cur}${htmlTotal.toFixed(2)}</span></div>
    ` : `
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px"><span>Parts</span><span>${cur}${partsTotal.toFixed(2)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px"><span>Services</span><span>${cur}${servicesTotal.toFixed(2)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px"><span>Labour</span><span>${cur}${labor.toFixed(2)}</span></div>
      <div style="display:flex;justify-content:space-between;padding-top:10px;margin-top:4px;border-top:2px solid #1a1a1a;font-weight:bold;font-size:18px"><span>TOTAL</span><span>${cur}${htmlTotal.toFixed(2)}</span></div>
    `;

    const paidStamp = data.job.payment_status === "paid" ? `
      <div style="color:#22c55e;font-size:20px;font-weight:bold;border:3px solid #22c55e;display:inline-block;padding:2px 12px;margin-top:8px;transform:rotate(-5deg)">PAID</div>
    ` : "";

    const printBtnHtml = opts?.showPrintBtn ? `
      <div class="no-print" style="text-align:center;margin-bottom:20px">
        <button onclick="window.print()" style="background:#e63946;color:white;border:none;padding:14px 40px;font-size:16px;font-weight:bold;border-radius:8px;cursor:pointer;min-height:48px">
          🖨️ Print this Invoice
        </button>
        ${opts?.showEmailLink ? `
          <a href="mailto:${custEmail || ""}?subject=${encodeURIComponent(`Invoice ${invoiceNum} — ${workshop.name}`)}" 
             style="display:inline-block;margin-left:12px;background:#3b82f6;color:white;text-decoration:none;padding:14px 40px;font-size:16px;font-weight:bold;border-radius:8px;min-height:48px">
            ✉️ Share via Email
          </a>
        ` : ""}
      </div>
    ` : "";

    return `
      <html><head><meta charset="UTF-8"><title>Invoice ${invoiceNum}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Segoe UI',Arial,sans-serif; padding:40px; color:#1a1a1a; background:#fff; }
        @media print { 
          body { padding:20px; } 
          .no-print { display:none !important; }
        }
        @media (max-width:600px) {
          body { padding:16px; }
        }
      </style></head><body>

      ${printBtnHtml}

      <!-- Header with logo -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;border-bottom:3px solid #e63946;padding-bottom:16px;flex-wrap:wrap;gap:12px">
        <div style="display:flex;align-items:center;gap:16px">
          ${logoBase64 ? `<img src="${logoBase64}" style="height:60px;width:auto;object-fit:contain" />` : ""}
          <div>
            <div style="font-size:22px;font-weight:bold;color:#e63946">${workshop.name}</div>
            ${workshop.address ? `<p style="font-size:12px;color:#666;margin-top:4px">${workshop.address}</p>` : ""}
            ${workshop.phone ? `<p style="font-size:12px;color:#666">Tel: ${workshop.phone}</p>` : ""}
            ${workshop.email ? `<p style="font-size:12px;color:#666">${workshop.email}</p>` : ""}
          </div>
        </div>
        <div style="text-align:right">
           <div style="font-size:18px;font-weight:bold">INVOICE</div>
          <p style="font-size:13px;color:#666">${invoiceNum}</p>
          <p style="font-size:13px;color:#666">Date: ${new Date().toLocaleDateString("en-GB")}</p>
          ${paidStamp}
        </div>
      </div>

      <!-- Customer & Vehicle -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
        <div style="background:#f8f8f8;padding:12px;border-radius:8px">
          <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#666;margin-bottom:6px">Bill To</h3>
          <p style="font-size:13px;line-height:1.6">
            <strong>${custName}</strong><br/>
            ${custAddress ? custAddress + "<br/>" : ""}
            ${custPhone ? "Tel: " + custPhone + "<br/>" : ""}
            ${custEmail || ""}
          </p>
        </div>
        <div style="background:#f8f8f8;padding:12px;border-radius:8px">
          <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#666;margin-bottom:6px">Vehicle</h3>
          <p style="font-size:13px;line-height:1.6">
            <strong>${motoMake} ${motoModel}</strong><br/>
            Registration: ${motoReg}<br/>
            ${motoYear ? "Year: " + motoYear : ""}
          </p>
        </div>
      </div>

      <!-- Description -->
      <div style="margin-bottom:20px;padding:12px;background:#fafafa;border-radius:8px;border-left:3px solid #e63946">
        <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#666;margin-bottom:4px">Work Description</h3>
        <p style="font-size:13px">${description}</p>
      </div>

      <!-- Items table -->
      ${hasItems ? `
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
          <thead>
            <tr>
              <th style="background:#1a1a1a;color:white;padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px">Item</th>
              <th style="background:#1a1a1a;color:white;padding:8px 12px;text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:1px">Qty</th>
              <th style="background:#1a1a1a;color:white;padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:1px">Unit Price</th>
              <th style="background:#1a1a1a;color:white;padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:1px">Total</th>
            </tr>
          </thead>
          <tbody>${allRows}</tbody>
        </table>
      ` : ""}

      <!-- Totals -->
      <div style="margin-left:auto;width:280px">
        ${totalsSection}
      </div>

      ${!withVat ? `<p style="margin-top:12px;font-size:11px;color:#999;text-align:right">* VAT not applicable</p>` : ""}

      <!-- Footer -->
      <div style="margin-top:40px;text-align:center;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:15px">
        Thank you for choosing ${workshop.name}. We appreciate your business!
      </div>

      </body></html>
    `;
  };

  const openInvoiceInNewTab = async (withVat: boolean) => {
    await handleSaveLaborCost();
    const html = await buildInvoiceHTML(withVat, { showPrintBtn: true, showEmailLink: true });
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    // Cleanup after a delay
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const handlePrint = async (withVat: boolean) => {
    await openInvoiceInNewTab(withVat);
  };

  const invoiceText = (withVat: boolean) => {
    const textVat = withVat ? subtotal * vatRate : 0;
    const textTotal = subtotal + textVat;
    const lines = [
      `*${workshop.name}*`,
      `Invoice: ${data.job.invoice_number || data.job.job_number}`,
      `Date: ${new Date().toLocaleDateString("en-GB")}`,
      ``,
      `*Customer:* ${custName}`,
      `*Vehicle:* ${motoMake} ${motoModel} (${motoReg})`,
      ``,
      `*Description:* ${description}`,
      ``,
      ...data.parts.map(p => `${p.name} x${p.quantity} — ${cur}${(p.quantity * p.unit_price).toFixed(2)}`),
      ...(data.services || []).map(s => `${s.description} — ${cur}${s.price.toFixed(2)}`),
      ``,
    ];
    lines.push(`Parts: ${cur}${partsTotal.toFixed(2)}`);
    lines.push(`Services: ${cur}${servicesTotal.toFixed(2)}`);
    lines.push(`Labour: ${cur}${labor.toFixed(2)}`);
    if (withVat) {
      lines.push(`Subtotal: ${cur}${subtotal.toFixed(2)}`);
      lines.push(`VAT (${workshop.vat_rate}%): ${cur}${textVat.toFixed(2)}`);
    }
    lines.push(`*TOTAL: ${cur}${textTotal.toFixed(2)}*`);
    return lines.join("\n");
  };

  const formatPhoneForWhatsApp = (phone: string) => {
    let cleaned = phone.replace(/[\s\-\(\)]/g, "");
    // If starts with 0, assume UK and replace with 44
    if (cleaned.startsWith("0")) cleaned = "44" + cleaned.substring(1);
    // If doesn't start with +, add +
    if (!cleaned.startsWith("+")) cleaned = "+" + cleaned;
    return cleaned;
  };

  const handleWhatsApp = async () => {
    await handleSaveLaborCost();
    const phone = custPhone ? formatPhoneForWhatsApp(custPhone) : "";
    if (!phone) {
      alert("No phone number available for this customer.");
      return;
    }
    const text = encodeURIComponent(invoiceText(includeVat));
    const url = `https://wa.me/${phone.replace("+", "")}?text=${text}`;
    window.open(url, "_blank");
  };

  const handleEmail = async () => {
    await handleSaveLaborCost();
    const invoiceNum = data.job.invoice_number || data.job.job_number;
    const subject = encodeURIComponent(`Invoice ${invoiceNum} — ${workshop.name}`);
    const body = encodeURIComponent(invoiceText(includeVat));
    if (custEmail) {
      window.open(`mailto:${custEmail}?subject=${subject}&body=${body}`, "_blank");
    } else {
      // No email — open the formatted invoice in new tab for manual sharing
      await openInvoiceInNewTab(includeVat);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl rounded-xl border border-border bg-card max-h-[95vh] overflow-y-auto">
        
        {/* Toolbar */}
        <div className="sticky top-0 z-10 border-b border-border bg-card px-4 sm:px-5 py-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-foreground">Invoice</h2>
            <button onClick={onClose} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"><X className="h-5 w-5 text-muted-foreground" /></button>
          </div>
          
          {/* Labour & Mark Paid */}
          {data.job.payment_status !== "paid" && (
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary px-2 py-2 flex-1">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Labour {cur}</span>
                <input type="number" value={laborCost} onChange={(e) => setLaborCost(e.target.value)}
                  className="w-full bg-transparent text-sm text-foreground focus:outline-none" step="0.01" />
              </div>
              <button onClick={handleMarkPaid} disabled={saving}
                className="flex items-center gap-1.5 rounded-lg bg-chart-green px-4 py-2 min-h-[44px] text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50 whitespace-nowrap">
                <CheckCircle className="h-4 w-4" /> {saving ? "..." : "Mark Paid"}
              </button>
            </div>
          )}

          {/* Action buttons - grid on mobile */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
            <button onClick={() => setIncludeVat(!includeVat)}
              className={`rounded-lg border px-3 py-2 min-h-[44px] text-xs font-semibold transition-all ${includeVat ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary text-muted-foreground"}`}>
              {includeVat ? `VAT ${workshop.vat_rate}% ON` : "No VAT"}
            </button>
            <button onClick={() => handlePrint(includeVat)}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 min-h-[44px] text-xs font-semibold text-primary-foreground hover:brightness-110">
              <Printer className="h-4 w-4" /> Print
            </button>
            <button onClick={handleWhatsApp}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 min-h-[44px] text-xs font-semibold text-white hover:brightness-110">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </button>
            <button onClick={handleEmail}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-chart-blue px-3 py-2 min-h-[44px] text-xs font-semibold text-white hover:brightness-110">
              <Mail className="h-4 w-4" /> Email
            </button>
          </div>
        </div>

        {/* Preview — white background for correct contrast */}
        <div className="p-6" style={{ background: "#fff", color: "#1a1a1a", borderRadius: "0 0 12px 12px" }}>
          {/* Header with logo */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, borderBottom: "3px solid #e63946", paddingBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <img src={logoImg} alt="Logo" style={{ height: 50, width: "auto", objectFit: "contain" }} />
              <div>
                <div style={{ fontSize: 22, fontWeight: "bold", color: "#e63946" }}>{workshop.name}</div>
                {workshop.address && <p style={{ fontSize: 12, color: "#666", marginTop: 4 }}>{workshop.address}</p>}
                {workshop.phone && <p style={{ fontSize: 12, color: "#666" }}>Tel: {workshop.phone}</p>}
                {workshop.email && <p style={{ fontSize: 12, color: "#666" }}>{workshop.email}</p>}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 18, fontWeight: "bold" }}>INVOICE</div>
              <p style={{ fontSize: 13, color: "#666" }}>{data.job.invoice_number || data.job.job_number}</p>
              <p style={{ fontSize: 13, color: "#666" }}>Date: {new Date().toLocaleDateString("en-GB")}</p>
              {data.job.payment_status === "paid" && (
                <div style={{ color: "#22c55e", fontSize: 20, fontWeight: "bold", border: "3px solid #22c55e", display: "inline-block", padding: "2px 12px", marginTop: 8, transform: "rotate(-5deg)" }}>PAID</div>
              )}
            </div>
          </div>

          {/* Customer & Vehicle — editable */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="rounded-lg bg-secondary p-3 space-y-2">
              <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground">Bill To</h3>
              <input value={custName} onChange={e => setCustName(e.target.value)} placeholder="Customer name"
                className="w-full bg-transparent text-sm font-semibold text-foreground focus:outline-none border-b border-border/50 pb-1" />
              <input value={custAddress} onChange={e => setCustAddress(e.target.value)} placeholder="Address"
                className="w-full bg-transparent text-xs text-muted-foreground focus:outline-none" />
              <input value={custPhone} onChange={e => setCustPhone(e.target.value)} placeholder="Phone"
                className="w-full bg-transparent text-xs text-muted-foreground focus:outline-none" />
              <input value={custEmail} onChange={e => setCustEmail(e.target.value)} placeholder="Email"
                className="w-full bg-transparent text-xs text-muted-foreground focus:outline-none" />
            </div>
            <div className="rounded-lg bg-secondary p-3 space-y-2">
              <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground">Vehicle</h3>
              <div className="flex gap-2">
                <input value={motoMake} onChange={e => setMotoMake(e.target.value)} placeholder="Make"
                  className="w-1/2 bg-transparent text-sm font-semibold text-foreground focus:outline-none border-b border-border/50 pb-1" />
                <input value={motoModel} onChange={e => setMotoModel(e.target.value)} placeholder="Model"
                  className="w-1/2 bg-transparent text-sm font-semibold text-foreground focus:outline-none border-b border-border/50 pb-1" />
              </div>
              <input value={motoReg} onChange={e => setMotoReg(e.target.value)} placeholder="Registration"
                className="w-full bg-transparent text-xs text-muted-foreground focus:outline-none" />
              <input value={motoYear} onChange={e => setMotoYear(e.target.value)} placeholder="Year"
                className="w-full bg-transparent text-xs text-muted-foreground focus:outline-none" />
            </div>
          </div>

          {/* Description */}
          <div className="mb-5 rounded-lg bg-secondary p-3" style={{ borderLeft: "3px solid #e63946" }}>
            <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Work Description</h3>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              className="w-full bg-transparent text-sm text-foreground focus:outline-none resize-none" />
          </div>

          {/* Items table */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20 }}>
            <thead>
              <tr>
                <th style={{ background: "#1a1a1a", color: "white", padding: "8px 12px", textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>Item</th>
                <th style={{ background: "#1a1a1a", color: "white", padding: "8px 12px", textAlign: "center", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>Qty</th>
                <th style={{ background: "#1a1a1a", color: "white", padding: "8px 12px", textAlign: "right", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>Unit Price</th>
                <th style={{ background: "#1a1a1a", color: "white", padding: "8px 12px", textAlign: "right", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {data.parts.map((p, i) => (
                <tr key={`part-${i}`}>
                  <td style={{ padding: "8px 12px", borderBottom: "1px solid #eee", fontSize: 13 }}>{p.name}</td>
                  <td style={{ padding: "8px 12px", borderBottom: "1px solid #eee", fontSize: 13, textAlign: "center" }}>{p.quantity}</td>
                  <td style={{ padding: "8px 12px", borderBottom: "1px solid #eee", fontSize: 13, textAlign: "right" }}>{cur}{p.unit_price.toFixed(2)}</td>
                  <td style={{ padding: "8px 12px", borderBottom: "1px solid #eee", fontSize: 13, textAlign: "right" }}>{cur}{(p.quantity * p.unit_price).toFixed(2)}</td>
                </tr>
              ))}
              {(data.services || []).map((s, i) => (
                <tr key={`svc-${i}`}>
                  <td style={{ padding: "8px 12px", borderBottom: "1px solid #eee", fontSize: 13 }}>{s.description}</td>
                  <td style={{ padding: "8px 12px", borderBottom: "1px solid #eee", fontSize: 13, textAlign: "center" }}>1</td>
                  <td style={{ padding: "8px 12px", borderBottom: "1px solid #eee", fontSize: 13, textAlign: "right" }}>{cur}{s.price.toFixed(2)}</td>
                  <td style={{ padding: "8px 12px", borderBottom: "1px solid #eee", fontSize: 13, textAlign: "right" }}>{cur}{s.price.toFixed(2)}</td>
                </tr>
              ))}
              {data.parts.length === 0 && (data.services || []).length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: "12px", textAlign: "center", fontSize: 13, color: "#999" }}>No items added</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Totals */}
          <div className="rounded-lg border border-border bg-secondary/50 p-4 w-full sm:w-[300px] sm:ml-auto">
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14 }}><span>Parts</span><span className="font-medium">{cur}{partsTotal.toFixed(2)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14 }}><span>Services</span><span className="font-medium">{cur}{servicesTotal.toFixed(2)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14 }}><span>Labour</span><span className="font-medium">{cur}{labor.toFixed(2)}</span></div>
            {includeVat && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14 }}><span>Subtotal</span><span className="font-medium">{cur}{subtotal.toFixed(2)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14, color: "#666" }}><span>VAT ({workshop.vat_rate}%)</span><span>{cur}{vat.toFixed(2)}</span></div>
              </>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, marginTop: 4, borderTop: "2px solid currentColor", fontWeight: "bold", fontSize: 18 }}>
              <span>TOTAL</span><span>{cur}{displayTotal.toFixed(2)}</span>
            </div>
          </div>

          {!includeVat && <p style={{ marginTop: 12, fontSize: 11, color: "#999", textAlign: "right" }}>* VAT not applicable</p>}

          <div style={{ marginTop: 40, textAlign: "center", fontSize: 11, color: "#999", borderTop: "1px solid #eee", paddingTop: 15 }}>
            Thank you for choosing {workshop.name}. We appreciate your business!
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default InvoiceModal;
