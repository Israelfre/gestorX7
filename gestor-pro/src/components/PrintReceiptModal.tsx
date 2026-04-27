import { useEffect } from "react";
import { useCompanySettings } from "@/hooks/use-company-settings";

type SaleItem = { inventoryId: number; name: string; quantity: number; unitPrice: number; total: number };
type Sale = {
  id: number;
  clientName?: string | null;
  sellerName?: string | null;
  items: SaleItem[];
  paymentType: string;
  paymentMethod: string;
  installments: number;
  subtotal: number;
  discount: number;
  total: number;
  notes?: string | null;
  createdAt: string;
};
type CompanyData = { name?: string; cnpj?: string; phone?: string; email?: string; address?: string; city?: string; logoUrl?: string } | undefined;

const PAYMENT_LABEL: Record<string, string> = {
  pix: "PIX", cartao_credito: "Cartão de Crédito", cartao_debito: "Cartão de Débito",
  dinheiro: "Dinheiro", boleto: "Boleto Bancário", crediario: "Crediário",
  avista: "À Vista", aprazo: "A Prazo",
};

export function openReceiptWindow(sale: Sale, company: CompanyData) {
  const receiptNum = String(sale.id).padStart(4, "0");
  const fmtMoney = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtDt = (s: string) => new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const logoHtml = company?.logoUrl
    ? `<img src="${company.logoUrl}" alt="Logo" style="max-height:64px;max-width:160px;margin:0 auto 8px;display:block;object-fit:contain">`
    : "";

  const companyLines = [
    company?.cnpj    ? `<div style="font-size:11px;color:#555">CNPJ: ${company.cnpj}</div>` : "",
    (company?.phone || company?.email)
      ? `<div style="font-size:11px;color:#555">${[company?.phone, company?.email].filter(Boolean).join(" · ")}</div>`
      : "",
    (company?.address || company?.city)
      ? `<div style="font-size:11px;color:#555">${[company?.address, company?.city].filter(Boolean).join(" — ")}</div>`
      : "",
  ].join("");

  const itemRows = sale.items.map((item, i) => `
    <tr style="border-top:1px solid #f0f0f0;background:${i%2===0?"#fff":"#f9fafb"}">
      <td style="padding:8px 12px;font-weight:500">${String(item.name).replace(/</g,"&lt;")}</td>
      <td style="padding:8px 8px;text-align:center;color:#555">${item.quantity}</td>
      <td style="padding:8px 8px;text-align:right;color:#555">${fmtMoney(item.unitPrice)}</td>
      <td style="padding:8px 12px;text-align:right;font-weight:600">${fmtMoney(item.total)}</td>
    </tr>`).join("");

  const subtotalRow = sale.subtotal !== sale.total
    ? `<div style="display:flex;justify-content:space-between;font-size:13px;color:#555;margin-bottom:4px"><span>Subtotal</span><span>${fmtMoney(sale.subtotal)}</span></div>`
    : "";
  const discountRow = sale.discount > 0
    ? `<div style="display:flex;justify-content:space-between;font-size:13px;color:#e74c3c;margin-bottom:4px"><span>Desconto</span><span>−${fmtMoney(sale.discount)}</span></div>`
    : "";

  const sellerRow = sale.sellerName
    ? `<div style="flex:1;min-width:120px">
        <div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:4px">Vendedor</div>
        <div style="font-size:13px;font-weight:600">${String(sale.sellerName).replace(/</g,"&lt;")}</div>
       </div>`
    : "";

  const notesBlock = sale.notes
    ? `<div style="background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;padding:10px 14px;margin-bottom:20px;font-size:12px;color:#555">
        <strong>Obs:</strong> ${String(sale.notes).replace(/</g,"&lt;")}
       </div>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Recibo Nº ${receiptNum} — GestorX7</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#111;background:#f0f0f0;min-height:100vh;padding:24px 16px 48px}
    .toolbar{position:sticky;top:0;z-index:100;background:#fff;border-bottom:1px solid #e5e7eb;padding:12px 24px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 2px 8px rgba(0,0,0,.08)}
    .toolbar-title{font-size:15px;font-weight:700;color:#111}
    .toolbar-sub{font-size:12px;color:#888;margin-top:1px}
    .btn-print{display:flex;align-items:center;gap:8px;background:#1AAF54;color:#fff;border:none;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer}
    .btn-print:hover{background:#158f44}
    .page{background:#fff;max-width:560px;margin:24px auto 0;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.10);padding:36px 40px}
    .footer-doc{margin-top:16px;text-align:center;font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:12px}
    @media print{
      body{background:#fff;padding:0}
      .toolbar{display:none!important}
      .page{box-shadow:none;border-radius:0;margin:0;padding:14mm 16mm;max-width:100%}
      *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
      @page{margin:0;size:A4 portrait}
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div>
      <div class="toolbar-title">Recibo de Venda — Nº ${receiptNum}</div>
      <div class="toolbar-sub">Confira o recibo abaixo e clique em Imprimir para salvar como PDF</div>
    </div>
    <button class="btn-print" onclick="window.print()">🖨 Imprimir / Gerar PDF</button>
  </div>

  <div class="page">
    <!-- Cabeçalho centrado -->
    <div style="text-align:center;border-bottom:2px solid #1AAF54;padding-bottom:16px;margin-bottom:20px">
      ${logoHtml}
      <div style="font-size:20px;font-weight:800;color:#1AAF54">${company?.name || "GestorX7"}</div>
      ${companyLines}
      <div style="margin-top:10px;background:#1AAF54;color:#fff;border-radius:6px;padding:4px 16px;display:inline-block;font-weight:700;font-size:15px;letter-spacing:1px">RECIBO</div>
      <div style="font-size:12px;color:#888;margin-top:4px">Nº ${receiptNum} · ${fmtDt(sale.createdAt)}</div>
    </div>

    <!-- Cliente / Pagamento / Vendedor -->
    <div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap">
      <div style="flex:1;min-width:120px">
        <div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:4px">Cliente</div>
        <div style="font-size:14px;font-weight:600">${String(sale.clientName || "Não informado").replace(/</g,"&lt;")}</div>
      </div>
      <div style="flex:1;min-width:120px">
        <div style="font-size:10px;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:4px">Forma de pagamento</div>
        <div style="font-size:13px;font-weight:600">${PAYMENT_LABEL[sale.paymentMethod] || sale.paymentMethod}${sale.installments > 1 ? ` (${sale.installments}×)` : ""}</div>
      </div>
      ${sellerRow}
    </div>

    <!-- Itens -->
    <div style="border:1px solid #e9ecef;border-radius:8px;overflow:hidden;margin-bottom:16px">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#f8f9fa">
            <th style="text-align:left;padding:8px 12px;font-weight:700;color:#555;font-size:10px;text-transform:uppercase">Item</th>
            <th style="text-align:center;padding:8px 8px;font-weight:700;color:#555;font-size:10px;text-transform:uppercase">Qtd</th>
            <th style="text-align:right;padding:8px 8px;font-weight:700;color:#555;font-size:10px;text-transform:uppercase">Unit.</th>
            <th style="text-align:right;padding:8px 12px;font-weight:700;color:#555;font-size:10px;text-transform:uppercase">Total</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
    </div>

    <!-- Totais -->
    <div style="margin-bottom:20px">
      ${subtotalRow}
      ${discountRow}
      <div style="display:flex;justify-content:space-between;background:#1AAF54;color:#fff;border-radius:8px;padding:10px 16px;margin-top:8px">
        <span style="font-weight:700;font-size:14px">TOTAL PAGO</span>
        <span style="font-weight:800;font-size:16px">${fmtMoney(sale.total)}</span>
      </div>
    </div>

    ${notesBlock}

    <!-- Assinaturas -->
    <div style="display:flex;gap:32px;margin-bottom:24px">
      <div style="flex:1;border-top:1px solid #ddd;padding-top:8px;font-size:11px;color:#888">Assinatura do Cliente</div>
      <div style="flex:1;border-top:1px solid #ddd;padding-top:8px;font-size:11px;color:#888">Assinatura da Empresa</div>
    </div>

    <div class="footer-doc">Recibo gerado pelo GestorX7 · Obrigado pela preferência!</div>
  </div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=700,height=750");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
}

export function PrintReceiptModal({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const { data: company } = useCompanySettings();
  useEffect(() => {
    if (company !== undefined) {
      openReceiptWindow(sale, company);
      onClose();
    }
  }, [company]);
  return null;
}
