import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Download, TrendingUp, Package, FileText, Calendar,
  BarChart2, CheckCircle2, Clock, XCircle, ShoppingBag,
  DollarSign, ArrowUpCircle, ArrowDownCircle, Wallet, Printer,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { useCompanySettings } from "@/hooks/use-company-settings";

// ─── CSV helpers ─────────────────────────────────────────────────────────────
function escapeCell(val: unknown): string {
  const s = val === null || val === undefined ? "" : String(val);
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}
function buildCsv(headers: string[], rows: unknown[][]): string {
  const bom = "\uFEFF"; // BOM for Excel UTF-8
  const lines = [headers.join(","), ...rows.map((r) => r.map(escapeCell).join(","))];
  return bom + lines.join("\n");
}
function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Period filter ────────────────────────────────────────────────────────────
type Period = "all" | "month" | "week" | "today";
const PERIOD_LABELS: { value: Period; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "week",  label: "7 dias" },
  { value: "month", label: "30 dias" },
  { value: "all",   label: "Tudo" },
];
function isInPeriod(dateStr: string, period: Period): boolean {
  if (period === "all") return true;
  const date = new Date(dateStr);
  const now = new Date();
  const days = period === "today" ? 0 : period === "week" ? 7 : 30;
  const cutoff = new Date(now);
  cutoff.setHours(0, 0, 0, 0);
  if (period === "today") {
    return date >= cutoff;
  }
  cutoff.setDate(cutoff.getDate() - days);
  return date >= cutoff;
}

// ─── Components ───────────────────────────────────────────────────────────────
function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
      {children}
    </div>
  );
}

function StatBadge({ label, value, color = "text-foreground" }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-muted/40 border rounded-xl p-2.5 text-center min-w-0">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5 truncate">{label}</p>
      <p className={`text-sm font-bold leading-tight break-all ${color}`}>{value}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Relatorios() {
  const [period, setPeriod] = useState<Period>("month");
  const { data: company } = useCompanySettings();

  const { data: txRaw = [] } = useQuery<any[]>({
    queryKey: ["financial-transactions-report"],
    queryFn: () => fetch("/api/financial/transactions").then((r) => r.json()),
  });
  const { data: inventoryRaw = [] } = useQuery<any[]>({
    queryKey: ["inventory-report"],
    queryFn: () => fetch("/api/inventory").then((r) => r.json()),
  });
  const { data: quotesRaw = [] } = useQuery<any[]>({
    queryKey: ["quotes-report"],
    queryFn: () => fetch("/api/quotes").then((r) => r.json()),
  });

  // ── Filtered data ──────────────────────────────────────────────────────────
  const vendas = txRaw.filter(
    (t) => t.type === "income" && isInPeriod(t.createdAt, period)
  );
  const despesas = txRaw.filter(
    (t) => t.type === "expense" && isInPeriod(t.createdAt, period)
  );
  const quotes = quotesRaw.filter((q) => isInPeriod(q.createdAt, period));

  const totalVendas = vendas.reduce((s: number, t: any) => s + Number(t.amount), 0);
  const totalDespesas = despesas.reduce((s: number, t: any) => s + Number(t.amount), 0);
  const lucro = totalVendas - totalDespesas;

  const totalEstoque = inventoryRaw.reduce((s: number, i: any) => s + Number(i.totalStockValue ?? 0), 0);
  const totalVendaEstoque = inventoryRaw.reduce((s: number, i: any) => s + Number(i.totalSaleValue ?? 0), 0);
  const avgMargin = inventoryRaw.length
    ? inventoryRaw.reduce((s: number, i: any) => s + Number(i.marginPct ?? 0), 0) / inventoryRaw.length
    : 0;

  const qPending   = quotes.filter((q: any) => q.status === "pending").length;
  const qConverted = quotes.filter((q: any) => q.status === "converted").length;
  const qRejected  = quotes.filter((q: any) => q.status === "rejected").length;
  const qTotal     = quotes.length;
  const conversionRate = qTotal > 0 ? ((qConverted / qTotal) * 100).toFixed(0) : "0";
  const totalOrcamentos = quotes.reduce((s: number, q: any) => s + Number(q.amount ?? 0), 0);

  // ── Download handlers ──────────────────────────────────────────────────────
  const downloadVendas = () => {
    const headers = ["Data", "Tipo", "Descrição", "Cliente", "Valor (R$)"];
    const allTx = txRaw.filter((t) => isInPeriod(t.createdAt, period));
    const rows = allTx.map((t: any) => [
      new Date(t.createdAt).toLocaleDateString("pt-BR"),
      t.type === "income" ? "Receita" : "Despesa",
      t.description,
      t.clientName ?? "",
      Number(t.amount).toFixed(2),
    ]);
    downloadCsv(
      `relatorio-vendas-${new Date().toISOString().slice(0, 10)}.csv`,
      buildCsv(headers, rows)
    );
  };

  const downloadProdutos = () => {
    const headers = [
      "Produto", "Quantidade", "Preço de Custo (R$)", "Preço de Venda (R$)",
      "Margem (%)", "Markup (%)", "Valor em Estoque (R$)", "Valor de Venda (R$)", "Estoque Baixo",
    ];
    const rows = inventoryRaw.map((i: any) => [
      i.name,
      i.quantity,
      Number(i.costPrice ?? 0).toFixed(2),
      Number(i.price ?? 0).toFixed(2),
      Number(i.marginPct ?? 0).toFixed(1),
      Number(i.markupPct ?? 0).toFixed(1),
      Number(i.totalStockValue ?? 0).toFixed(2),
      Number(i.totalSaleValue ?? 0).toFixed(2),
      i.isLowStock ? "Sim" : "Não",
    ]);
    downloadCsv(
      `relatorio-produtos-${new Date().toISOString().slice(0, 10)}.csv`,
      buildCsv(headers, rows)
    );
  };

  const downloadFinanceiro = () => {
    const allTx = txRaw.filter((t) => isInPeriod(t.createdAt, period));
    const headers = ["Data", "Tipo", "Descrição", "Cliente", "Valor (R$)", "Saldo Acumulado (R$)"];
    let saldo = 0;
    const rows = [...allTx]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((t: any) => {
        saldo += t.type === "income" ? Number(t.amount) : -Number(t.amount);
        return [
          new Date(t.createdAt).toLocaleDateString("pt-BR"),
          t.type === "income" ? "Receita" : "Despesa",
          t.description,
          t.clientName ?? "",
          (t.type === "income" ? "+" : "-") + Number(t.amount).toFixed(2),
          saldo.toFixed(2),
        ];
      });
    downloadCsv(
      `relatorio-financeiro-${new Date().toISOString().slice(0, 10)}.csv`,
      buildCsv(headers, rows)
    );
  };

  const downloadOrcamentos = () => {
    const headers = ["Data", "Cliente", "Descrição", "Valor (R$)", "Status"];
    const statusLabel: Record<string, string> = {
      pending: "Pendente", converted: "Convertido", rejected: "Recusado",
    };
    const rows = quotes.map((q: any) => [
      new Date(q.createdAt).toLocaleDateString("pt-BR"),
      q.clientName ?? "",
      q.description ?? q.title ?? "",
      Number(q.amount ?? 0).toFixed(2),
      statusLabel[q.status] ?? q.status,
    ]);
    downloadCsv(
      `relatorio-orcamentos-${new Date().toISOString().slice(0, 10)}.csv`,
      buildCsv(headers, rows)
    );
  };

  const downloadCompleto = () => {
    const lines: string[] = ["\uFEFF"];

    // ─ Financeiro ─
    const allTx = txRaw.filter((t) => isInPeriod(t.createdAt, period));
    lines.push("=== RELATÓRIO FINANCEIRO ===");
    lines.push(["Data","Tipo","Descrição","Cliente","Valor (R$)","Saldo Acumulado (R$)"].join(","));
    let saldo = 0;
    [...allTx].sort((a,b)=>new Date(a.createdAt).getTime()-new Date(b.createdAt).getTime()).forEach((t:any)=>{
      saldo += t.type === "income" ? Number(t.amount) : -Number(t.amount);
      lines.push([
        new Date(t.createdAt).toLocaleDateString("pt-BR"),
        t.type === "income" ? "Receita" : "Despesa",
        escapeCell(t.description), escapeCell(t.clientName??""),
        (t.type==="income"?"+":"-")+Number(t.amount).toFixed(2),
        saldo.toFixed(2),
      ].join(","));
    });

    // ─ Vendas ─
    lines.push("");
    lines.push("=== RELATÓRIO DE VENDAS ===");
    lines.push(["Data", "Tipo", "Descrição", "Cliente", "Valor (R$)"].join(","));
    allTx.forEach((t: any) => {
      lines.push([
        new Date(t.createdAt).toLocaleDateString("pt-BR"),
        t.type === "income" ? "Receita" : "Despesa",
        escapeCell(t.description),
        escapeCell(t.clientName ?? ""),
        Number(t.amount).toFixed(2),
      ].join(","));
    });

    lines.push("");
    lines.push("=== RELATÓRIO DE PRODUTOS ===");
    lines.push(["Produto","Qtd","Custo","Preço","Margem %","Markup %","Estoque R$","Venda R$","Baixo Estoque"].join(","));
    inventoryRaw.forEach((i: any) => {
      lines.push([
        escapeCell(i.name), i.quantity,
        Number(i.costPrice??0).toFixed(2), Number(i.price??0).toFixed(2),
        Number(i.marginPct??0).toFixed(1), Number(i.markupPct??0).toFixed(1),
        Number(i.totalStockValue??0).toFixed(2), Number(i.totalSaleValue??0).toFixed(2),
        i.isLowStock?"Sim":"Não",
      ].join(","));
    });

    lines.push("");
    lines.push("=== RELATÓRIO DE ORÇAMENTOS ===");
    lines.push(["Data","Cliente","Descrição","Valor R$","Status"].join(","));
    quotes.forEach((q: any) => {
      const st = {pending:"Pendente",converted:"Convertido",rejected:"Recusado"}[q.status as string] ?? q.status;
      lines.push([
        new Date(q.createdAt).toLocaleDateString("pt-BR"),
        escapeCell(q.clientName??""),
        escapeCell(q.description??q.title??""),
        Number(q.amount??0).toFixed(2),
        st,
      ].join(","));
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-completo-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const periodLabel = PERIOD_LABELS.find((p) => p.value === period)?.label ?? "";
  const fmtR = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtDateR = (s: string) => new Date(s).toLocaleDateString("pt-BR");

  const handlePrint = () => {
    const now = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    const allTxPeriod = [...txRaw.filter((t) => isInPeriod(t.createdAt, period))]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const logoHtml = company?.logoUrl
      ? `<img src="${company.logoUrl}" alt="Logo" style="max-height:48px;max-width:100px;object-fit:contain">`
      : "";
    const companyInfo = [
      company?.cnpj ? `<span>CNPJ: ${company.cnpj}</span>` : "",
      (company?.phone || company?.email) ? `<span>${[company?.phone, company?.email].filter(Boolean).join(" · ")}</span>` : "",
    ].filter(Boolean).join("<br>");

    // ── Financeiro rows ──────────────────────────────────────────────
    const txRows = allTxPeriod.map((t, i) => `
      <tr style="background:${i%2===0?"#fff":"#f9fafb"}">
        <td>${fmtDateR(t.createdAt)}</td>
        <td style="color:${t.type==="income"?"#16a34a":"#dc2626"}">${t.type==="income"?"Receita":"Despesa"}</td>
        <td>${String(t.description||"").replace(/</g,"&lt;")}</td>
        <td>${String(t.clientName||"—").replace(/</g,"&lt;")}</td>
        <td style="text-align:right;font-weight:600;color:${t.type==="income"?"#16a34a":"#dc2626"}">${t.type==="income"?"+":"−"}${fmtR(Number(t.amount))}</td>
      </tr>`).join("");

    // ── Produtos rows ────────────────────────────────────────────────
    const prodRows = inventoryRaw.map((i: any, idx: number) => `
      <tr style="background:${idx%2===0?"#fff":"#f9fafb"}">
        <td style="font-weight:600">${String(i.name).replace(/</g,"&lt;")}${i.isLowStock?` <span style="font-size:10px;background:#fef3c7;color:#92400e;padding:1px 5px;border-radius:4px">baixo</span>`:""}</td>
        <td style="text-align:center">${i.quantity}</td>
        <td style="text-align:right">${fmtR(Number(i.costPrice??0))}</td>
        <td style="text-align:right">${fmtR(Number(i.price??0))}</td>
        <td style="text-align:right">${Number(i.marginPct??0).toFixed(1)}%</td>
        <td style="text-align:right">${fmtR(Number(i.totalStockValue??0))}</td>
      </tr>`).join("");

    // ── Orçamentos rows ──────────────────────────────────────────────
    const stLabel: Record<string,string> = {pending:"Pendente",converted:"Convertido",rejected:"Recusado"};
    const stColor: Record<string,string> = {pending:"#e67e00",converted:"#16a34a",rejected:"#888"};
    const quotesRows = quotes.map((q: any, idx: number) => `
      <tr style="background:${idx%2===0?"#fff":"#f9fafb"}">
        <td>${fmtDateR(q.createdAt)}</td>
        <td>${String(q.clientName||"—").replace(/</g,"&lt;")}</td>
        <td>${String(q.description||q.title||"").replace(/</g,"&lt;")}</td>
        <td style="text-align:right;font-weight:600">${fmtR(Number(q.amount??0))}</td>
        <td style="color:${stColor[q.status]||"#888"};font-weight:600">${stLabel[q.status]||q.status}</td>
      </tr>`).join("");

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Relatório GestorX7 — ${periodLabel}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#111;background:#f0f0f0;min-height:100vh;padding:24px 16px 48px}
    .toolbar{position:sticky;top:0;z-index:100;background:#fff;border-bottom:1px solid #e5e7eb;padding:12px 24px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 2px 8px rgba(0,0,0,.08)}
    .toolbar-title{font-size:15px;font-weight:700;color:#111}
    .toolbar-sub{font-size:12px;color:#888;margin-top:1px}
    .btn-print{display:flex;align-items:center;gap:8px;background:#1AAF54;color:#fff;border:none;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer}
    .btn-print:hover{background:#158f44}
    .page{background:#fff;max-width:900px;margin:24px auto 0;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.10);padding:36px 44px}
    .co-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1AAF54;padding-bottom:14px;margin-bottom:28px}
    .co-left{display:flex;align-items:flex-start;gap:12px}
    .co-name{font-size:20px;font-weight:800;color:#1AAF54}
    .co-info{font-size:11px;color:#555;margin-top:3px;line-height:1.6}
    .section{margin-bottom:32px}
    .section-title{font-size:14px;font-weight:700;color:#1AAF54;border-left:4px solid #1AAF54;padding-left:10px;margin-bottom:14px}
    .stats{display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap}
    .stat{flex:1;min-width:120px;background:#f8f9fa;border-radius:8px;padding:10px 14px;border:1px solid #e9ecef}
    .stat-label{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px}
    .stat-value{font-size:15px;font-weight:700}
    table{width:100%;border-collapse:collapse;font-size:12px}
    thead tr{background:#1AAF54;color:#fff}
    thead th{padding:8px 10px;text-align:left;font-weight:600}
    thead th.r{text-align:right} thead th.c{text-align:center}
    tbody td{padding:8px 10px;border-bottom:1px solid #e5e7eb}
    tfoot td{padding:8px 10px;font-weight:700;border-top:2px solid #1AAF54;background:#f9fafb}
    .footer-doc{margin-top:28px;font-size:11px;color:#bbb;text-align:center}
    @media print{
      body{background:#fff;padding:0}
      .toolbar{display:none!important}
      .page{box-shadow:none;border-radius:0;margin:0;padding:10mm 14mm}
      *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
      @page{margin:0;size:A4 portrait}
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div>
      <div class="toolbar-title">Relatório GestorX7 — Período: ${periodLabel}</div>
      <div class="toolbar-sub">Confira abaixo e clique em Imprimir para salvar como PDF</div>
    </div>
    <button class="btn-print" onclick="window.print()">🖨 Imprimir / Gerar PDF</button>
  </div>

  <div class="page">
    <div class="co-header">
      <div class="co-left">
        ${logoHtml}
        <div>
          <div class="co-name">${company?.name || "GestorX7"}</div>
          <div class="co-info">${companyInfo}</div>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:16px;font-weight:700">RELATÓRIO</div>
        <div style="font-size:12px;color:#888">Período: ${periodLabel}</div>
        <div style="font-size:12px;color:#888">Emitido em ${now}</div>
      </div>
    </div>

    <!-- Financeiro -->
    <div class="section">
      <div class="section-title">Financeiro</div>
      <div class="stats">
        <div class="stat"><div class="stat-label">Receitas</div><div class="stat-value" style="color:#16a34a">${fmtR(totalVendas)}</div></div>
        <div class="stat"><div class="stat-label">Despesas</div><div class="stat-value" style="color:#dc2626">${fmtR(totalDespesas)}</div></div>
        <div class="stat"><div class="stat-label">Saldo</div><div class="stat-value" style="color:${lucro>=0?"#16a34a":"#dc2626"}">${fmtR(lucro)}</div></div>
        <div class="stat"><div class="stat-label">Margem</div><div class="stat-value">${totalVendas>0?((lucro/totalVendas)*100).toFixed(0)+"%" :"—"}</div></div>
      </div>
      ${allTxPeriod.length === 0 ? "<p style='color:#888;font-size:12px;text-align:center;padding:16px'>Nenhum lançamento no período</p>" : `
      <table>
        <thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Cliente</th><th class="r">Valor</th></tr></thead>
        <tbody>${txRows}</tbody>
        <tfoot><tr>
          <td colspan="4">Total (${allTxPeriod.length} lançamentos)</td>
          <td style="text-align:right;color:${lucro>=0?"#16a34a":"#dc2626"}">${fmtR(lucro)}</td>
        </tr></tfoot>
      </table>`}
    </div>

    <!-- Produtos -->
    <div class="section">
      <div class="section-title">Produtos em Estoque</div>
      <div class="stats">
        <div class="stat"><div class="stat-label">Valor em Estoque</div><div class="stat-value" style="color:#2563eb">${fmtR(totalEstoque)}</div></div>
        <div class="stat"><div class="stat-label">Valor de Venda</div><div class="stat-value" style="color:#16a34a">${fmtR(totalVendaEstoque)}</div></div>
        <div class="stat"><div class="stat-label">Margem Média</div><div class="stat-value">${avgMargin.toFixed(1)}%</div></div>
      </div>
      ${inventoryRaw.length === 0 ? "<p style='color:#888;font-size:12px;text-align:center;padding:16px'>Nenhum produto cadastrado</p>" : `
      <table>
        <thead><tr><th>Produto</th><th class="c">Qtd</th><th class="r">Custo</th><th class="r">Preço</th><th class="r">Margem</th><th class="r">Estoque R$</th></tr></thead>
        <tbody>${prodRows}</tbody>
        <tfoot><tr>
          <td colspan="5">Total (${inventoryRaw.length} produtos)</td>
          <td style="text-align:right">${fmtR(totalEstoque)}</td>
        </tr></tfoot>
      </table>`}
    </div>

    <!-- Orçamentos -->
    <div class="section">
      <div class="section-title">Orçamentos</div>
      <div class="stats">
        <div class="stat"><div class="stat-label">Total</div><div class="stat-value" style="color:#7c3aed">${fmtR(totalOrcamentos)}</div></div>
        <div class="stat"><div class="stat-label">Pendentes</div><div class="stat-value" style="color:#e67e00">${qPending}</div></div>
        <div class="stat"><div class="stat-label">Convertidos</div><div class="stat-value" style="color:#16a34a">${qConverted}</div></div>
        <div class="stat"><div class="stat-label">Taxa de Conversão</div><div class="stat-value">${conversionRate}%</div></div>
      </div>
      ${quotes.length === 0 ? "<p style='color:#888;font-size:12px;text-align:center;padding:16px'>Nenhum orçamento no período</p>" : `
      <table>
        <thead><tr><th>Data</th><th>Cliente</th><th>Descrição</th><th class="r">Valor</th><th>Status</th></tr></thead>
        <tbody>${quotesRows}</tbody>
        <tfoot><tr>
          <td colspan="3">Total (${quotes.length} orçamentos)</td>
          <td style="text-align:right">${fmtR(totalOrcamentos)}</td>
          <td></td>
        </tr></tfoot>
      </table>`}
    </div>

    <div class="footer-doc">GestorX7 — Relatório emitido em ${now}</div>
  </div>
</body>
</html>`;

    const win = window.open("", "_blank", "width=1000,height=750");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-primary" />
            Relatórios
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Exporte dados de vendas, produtos e orçamentos</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3 py-2 border rounded-xl text-sm font-medium hover:bg-muted active:scale-95 transition-all shrink-0 text-muted-foreground hover:text-foreground"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Imprimir</span>
          </button>
          <button
            onClick={downloadCompleto}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 active:scale-95 transition-all shrink-0 shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Relatório Completo</span>
            <span className="sm:hidden">Completo</span>
          </button>
        </div>
      </div>

      {/* Period filter */}
      <div className="flex gap-1.5 mb-5 bg-muted/40 p-1 rounded-xl w-full sm:w-fit border overflow-x-auto">
        {PERIOD_LABELS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-all ${
              period === p.value
                ? "bg-white shadow text-foreground border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {/* ── Financeiro ───────────────────────────────────────────────── */}
        <SectionCard>
          <div className="p-4 border-b flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                <DollarSign className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold">Relatório Financeiro</p>
                <p className="text-xs text-muted-foreground">
                  {periodLabel} · {txRaw.filter((t) => isInPeriod(t.createdAt, period)).length} lançamentos · saldo acumulado
                </p>
              </div>
            </div>
            <button
              onClick={downloadFinanceiro}
              className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm font-medium hover:bg-muted active:scale-95 transition-all text-muted-foreground hover:text-foreground shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Baixar CSV
            </button>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              <StatBadge label="Receitas" value={formatCurrency(totalVendas)} color="text-primary" />
              <StatBadge label="Despesas" value={formatCurrency(totalDespesas)} color="text-destructive" />
              <StatBadge label="Saldo" value={formatCurrency(lucro)} color={lucro >= 0 ? "text-emerald-600" : "text-destructive"} />
              <StatBadge
                label="Margem"
                value={totalVendas > 0 ? `${((lucro / totalVendas) * 100).toFixed(0)}%` : "—"}
                color={lucro >= 0 ? "text-emerald-600" : "text-destructive"}
              />
            </div>
            {/* Transaction list with running balance */}
            {txRaw.filter((t) => isInPeriod(t.createdAt, period)).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum lançamento no período</p>
            ) : (() => {
              const allTxPeriod = [...txRaw.filter((t) => isInPeriod(t.createdAt, period))]
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              // compute full saldo first to show final balance
              const finalSaldo = txRaw
                .filter((t) => isInPeriod(t.createdAt, period))
                .reduce((s: number, t: any) => s + (t.type === "income" ? Number(t.amount) : -Number(t.amount)), 0);
              return (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {/* Final balance banner */}
                  <div className={`flex items-center justify-between px-3 py-2 rounded-xl mb-2 border ${finalSaldo >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-destructive/5 border-destructive/20"}`}>
                    <div className="flex items-center gap-2">
                      <Wallet className={`w-4 h-4 ${finalSaldo >= 0 ? "text-emerald-600" : "text-destructive"}`} />
                      <span className="text-sm font-semibold">Saldo no período</span>
                    </div>
                    <span className={`text-sm font-bold ${finalSaldo >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                      {finalSaldo >= 0 ? "+" : ""}{formatCurrency(finalSaldo)}
                    </span>
                  </div>
                  {allTxPeriod.slice(0, 12).map((t: any) => {
                    const isIncome = t.type === "income";
                    const Icon = isIncome ? ArrowUpCircle : ArrowDownCircle;
                    return (
                      <div key={t.id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/40 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon className={`w-3.5 h-3.5 shrink-0 ${isIncome ? "text-primary" : "text-destructive"}`} />
                          <span className="truncate">{t.description}</span>
                          {t.clientName && <span className="text-xs text-muted-foreground shrink-0">· {t.clientName}</span>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`font-semibold text-sm ${isIncome ? "text-primary" : "text-destructive"}`}>
                            {isIncome ? "+" : "−"}{formatCurrency(t.amount)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(t.createdAt).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {txRaw.filter((t) => isInPeriod(t.createdAt, period)).length > 12 && (
                    <p className="text-xs text-muted-foreground text-center pt-1">
                      + {txRaw.filter((t) => isInPeriod(t.createdAt, period)).length - 12} lançamentos no CSV
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
        </SectionCard>

        {/* ── Vendas ───────────────────────────────────────────────────── */}
        <SectionCard>
          <div className="p-4 border-b flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold">Relatório de Vendas</p>
                <p className="text-xs text-muted-foreground">{periodLabel} · {txRaw.filter((t) => isInPeriod(t.createdAt, period)).length} lançamentos</p>
              </div>
            </div>
            <button
              onClick={downloadVendas}
              className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm font-medium hover:bg-muted active:scale-95 transition-all text-muted-foreground hover:text-foreground shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Baixar CSV
            </button>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-3 gap-2 mb-4">
              <StatBadge label="Receitas" value={formatCurrency(totalVendas)} color="text-primary" />
              <StatBadge label="Despesas" value={formatCurrency(totalDespesas)} color="text-destructive" />
              <StatBadge label="Lucro Líquido" value={formatCurrency(lucro)} color={lucro >= 0 ? "text-primary" : "text-destructive"} />
            </div>
            {vendas.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma venda no período</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {vendas.slice(0, 10).map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/40 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <ShoppingBag className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="truncate text-sm">{t.description}</span>
                      {t.clientName && <span className="text-xs text-muted-foreground shrink-0">· {t.clientName}</span>}
                    </div>
                    <span className="text-primary font-semibold shrink-0">{formatCurrency(t.amount)}</span>
                  </div>
                ))}
                {vendas.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">+ {vendas.length - 10} itens no CSV</p>
                )}
              </div>
            )}
          </div>
        </SectionCard>

        {/* ── Produtos ─────────────────────────────────────────────────── */}
        <SectionCard>
          <div className="p-4 border-b flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold">Relatório de Produtos</p>
                <p className="text-xs text-muted-foreground">{inventoryRaw.length} produtos · estoque completo</p>
              </div>
            </div>
            <button
              onClick={downloadProdutos}
              className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm font-medium hover:bg-muted active:scale-95 transition-all text-muted-foreground hover:text-foreground shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Baixar CSV
            </button>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-3 gap-2 mb-4">
              <StatBadge label="Valor em Estoque" value={formatCurrency(totalEstoque)} color="text-blue-600" />
              <StatBadge label="Valor de Venda" value={formatCurrency(totalVendaEstoque)} color="text-primary" />
              <StatBadge label="Margem Média" value={`${avgMargin.toFixed(1)}%`} />
            </div>
            {inventoryRaw.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum produto no estoque</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {inventoryRaw.map((i: any) => (
                  <div key={i.id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/40 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <Package className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span className="font-medium truncate">{i.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">({i.quantity} un)</span>
                      {i.isLowStock && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium shrink-0">baixo</span>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold">{formatCurrency(i.price)}</p>
                      <p className="text-[10px] text-muted-foreground">{Number(i.marginPct).toFixed(0)}% margem</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>

        {/* ── Orçamentos ───────────────────────────────────────────────── */}
        <SectionCard>
          <div className="p-4 border-b flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-violet-50 text-violet-600 rounded-xl flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold">Relatório de Orçamentos</p>
                <p className="text-xs text-muted-foreground">{periodLabel} · {qTotal} orçamentos</p>
              </div>
            </div>
            <button
              onClick={downloadOrcamentos}
              className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm font-medium hover:bg-muted active:scale-95 transition-all text-muted-foreground hover:text-foreground shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Baixar CSV
            </button>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              <StatBadge label="Total" value={formatCurrency(totalOrcamentos)} color="text-violet-600" />
              <StatBadge label="Pendentes" value={String(qPending)} color="text-amber-600" />
              <StatBadge label="Convertidos" value={String(qConverted)} color="text-primary" />
              <StatBadge label="Conversão" value={`${conversionRate}%`} color={Number(conversionRate) >= 50 ? "text-primary" : "text-destructive"} />
            </div>
            {qTotal === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum orçamento no período</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {quotes.slice(0, 10).map((q: any) => {
                  const statusConfig = {
                    pending:   { icon: Clock, color: "text-amber-500", label: "Pendente" },
                    converted: { icon: CheckCircle2, color: "text-primary", label: "Convertido" },
                    rejected:  { icon: XCircle, color: "text-destructive", label: "Recusado" },
                  }[q.status as "pending"|"converted"|"rejected"] ?? { icon: Clock, color: "text-muted-foreground", label: q.status };
                  const Icon = statusConfig.icon;
                  return (
                    <div key={q.id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/40 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className={`w-3.5 h-3.5 shrink-0 ${statusConfig.color}`} />
                        <span className="truncate">{q.description ?? q.title ?? "Orçamento"}</span>
                        {q.clientName && <span className="text-xs text-muted-foreground shrink-0">· {q.clientName}</span>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold">{formatCurrency(q.amount)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(q.createdAt).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {quotes.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">+ {quotes.length - 10} itens no CSV</p>
                )}
              </div>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
