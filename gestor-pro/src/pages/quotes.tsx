import { useState, useEffect } from "react";
import { useConfirm } from "@/hooks/use-confirm";
import { useCompanySettings } from "@/hooks/use-company-settings";
import {
  useListQuotes, useCreateQuote, useUpdateQuote, useDeleteQuote, useConvertQuoteToSale,
  useListClients, getListQuotesQueryKey, getListTransactionsQueryKey,
  getGetFinancialSummaryQueryKey, getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, ShoppingCart, Pencil, Trash2, FileText, Tag, Calculator, CheckCircle2, Printer, X, Package, Search, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";

const quoteSchema = z.object({
  clientId: z.number().optional(),
  employeeId: z.number().optional().nullable(),
  commissionPct: z.number().min(0).max(100).optional().nullable(),
  subtotal: z.number().optional().nullable(),
  discount: z.number().optional().nullable(),
  amount: z.number().min(0),
  additionalNotes: z.string().optional(),
});

type QuoteForm = z.infer<typeof quoteSchema>;
type QuoteItem = { inventoryId: number; name: string; quantity: number; unitPrice: number; total: number };
type InventoryItem = { id: number; name: string; quantity: number; price: number };
type Employee = { id: number; name: string; role: string; commissionRate: number };
type Quote = { id: number; clientId?: number | null; clientName?: string | null; employeeId?: number | null; sellerName?: string | null; commissionPct?: number; commissionAmount?: number; description: string; subtotal?: number | null; discount?: number | null; amount: number; status: "pending" | "converted" | "rejected"; additionalNotes?: string | null; createdAt: string; };
type FullClient = { id: number; name: string; fantasia?: string | null; phone?: string | null; email?: string | null; cnpj?: string | null; logradouro?: string | null; numero?: string | null; bairro?: string | null; cidade?: string | null; cep?: string | null; personType?: string };
type FilterQ = "all" | "pending" | "converted" | "rejected";

const statusLabel: Record<string, string> = { pending: "Pendente", converted: "Convertido", rejected: "Recusado" };
const statusStyle: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  converted: "bg-primary/10 text-primary",
  rejected: "bg-muted text-muted-foreground",
};


// ─── OPEN PRINT WINDOW ────────────────────────────────────────────────────────
type CompanyData = { name?: string; cnpj?: string; phone?: string; email?: string; address?: string; city?: string; logoUrl?: string } | undefined;

function openPrintWindow(quote: Quote, company: CompanyData, client?: FullClient | null, discountOverride?: { subtotal: number; discount: number } | null) {
  const quoteNum = String(quote.id).padStart(4, "0");
  const issued = new Date(quote.createdAt);
  const valid = new Date(issued);
  valid.setDate(valid.getDate() + 30);
  const fmt = (d: Date) => d.toLocaleDateString("pt-BR");
  const fmtMoney = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const esc = (s?: string | null) => (s || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const statusLbl = quote.status === "pending" ? "Pendente" : quote.status === "converted" ? "Convertido" : "Recusado";
  const statusColor = quote.status === "pending" ? "#e67e00" : quote.status === "converted" ? "#1AAF54" : "#888";

  const logoHtml = company?.logoUrl
    ? `<img src="${company.logoUrl}" alt="Logo" style="max-height:56px;max-width:120px;object-fit:contain;display:block">`
    : "";

  const companyInfo = [
    company?.cnpj ? `<div style="font-size:11px;color:#555;margin-top:2px">CNPJ: ${esc(company.cnpj)}</div>` : "",
    (company?.phone || company?.email)
      ? `<div style="font-size:11px;color:#555;margin-top:1px">${[company?.phone, company?.email].filter(Boolean).map(esc).join(" · ")}</div>`
      : "",
    (company?.address || company?.city)
      ? `<div style="font-size:11px;color:#555;margin-top:1px">${[company?.address, company?.city].filter(Boolean).map(esc).join(" — ")}</div>`
      : "",
  ].join("");

  // ── Bloco de dados do cliente ──────────────────────────────────────────────
  const buildClientBlock = () => {
    const header = `<div class="section-title">Orçamento: <strong>${quoteNum}</strong> &nbsp;&nbsp;&nbsp; ${fmt(issued)}</div>`;
    if (client) {
      const isPJ = client.personType === "PJ";
      const docLabel = isPJ ? "CNPJ" : "CPF";
      const docVal = isPJ ? client.cnpj : (client as any).cpf;
      const rows: string[] = [];
      // Linha principal: Cliente (razão social ou nome)
      rows.push(`<tr><td class="lbl">Cliente:</td><td class="val" colspan="3">${esc(client.name)}</td></tr>`);
      // Se PJ e tem Nome Fantasia, mostra em linha separada
      if (isPJ && client.fantasia) {
        rows.push(`<tr><td class="lbl">Nome Fantasia:</td><td class="val" colspan="3">${esc(client.fantasia)}</td></tr>`);
      }
      if (docVal) {
        rows.push(`<tr><td class="lbl">${docLabel}:</td><td class="val" colspan="3"><strong>${esc(docVal)}</strong></td></tr>`);
      }
      const enderecoStr = [client.logradouro, client.numero].filter(Boolean).join(", ");
      const hasAddress = enderecoStr || client.bairro;
      if (hasAddress) {
        rows.push(`<tr>
          <td class="lbl">Endereço:</td>
          <td class="val">${esc(enderecoStr)}</td>
          ${client.bairro ? `<td style="font-size:11px"><span class="lbl">Bairro:</span> ${esc(client.bairro)}</td>` : "<td></td>"}
          <td></td>
        </tr>`);
      }
      const hasLocation = client.cep || client.cidade || client.phone;
      if (hasLocation) {
        rows.push(`<tr>
          ${client.cep ? `<td class="lbl">CEP:</td><td class="val">${esc(client.cep)}</td>` : "<td></td><td></td>"}
          ${client.cidade ? `<td style="font-size:11px"><span class="lbl">Cidade:</span> ${esc(client.cidade)}</td>` : "<td></td>"}
          ${client.phone ? `<td style="font-size:11px"><span class="lbl">Fone:</span> ${esc(client.phone)}</td>` : "<td></td>"}
        </tr>`);
      }
      return `<div class="client-block">${header}<table class="client-table">${rows.join("")}</table></div>`;
    }
    if (quote.clientName) {
      return `<div class="client-block">${header}<table class="client-table"><tr><td class="lbl">Cliente:</td><td class="val">${esc(quote.clientName)}</td></tr></table></div>`;
    }
    return "";
  };
  const clientBlock = buildClientBlock();

  // ── Bloco do vendedor ──────────────────────────────────────────────────────
  const sellerBlock = quote.sellerName ? `
    <div class="seller-block">
      <span class="lbl">Vendedor(es):</span>
      <span class="val">&nbsp;&nbsp; ${esc(quote.sellerName)}</span>
    </div>` : "";

  // ── Dados adicionais ────────────────────────────────────────────────────────
  const notesBlock = quote.additionalNotes ? `
    <div class="notes-block">
      <div class="notes-title">Dados Adicionais</div>
      <div class="notes-text">${esc(quote.additionalNotes)}</div>
    </div>` : "";

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Orçamento Nº ${quoteNum} — GestorX7</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#111;background:#f0f0f0;min-height:100vh;padding:24px 16px 48px}
    .toolbar{position:sticky;top:0;z-index:100;background:#fff;border-bottom:1px solid #e5e7eb;padding:12px 24px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 2px 8px rgba(0,0,0,.08)}
    .toolbar-title{font-size:15px;font-weight:700;color:#111}
    .toolbar-sub{font-size:12px;color:#888;margin-top:1px}
    .btn-print{display:flex;align-items:center;gap:8px;background:#1AAF54;color:#fff;border:none;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;transition:background .2s}
    .btn-print:hover{background:#158f44}
    .page{background:#fff;max-width:760px;margin:24px auto 0;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.10);padding:40px 48px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1AAF54;padding-bottom:18px;margin-bottom:20px}
    .header-left{display:flex;align-items:flex-start;gap:14px}
    .company-name{font-size:22px;font-weight:800;color:#1AAF54;letter-spacing:-.5px}
    /* Cliente block */
    .client-block{border:1px solid #ccc;border-radius:6px;margin-bottom:16px;overflow:hidden}
    .section-title{background:#333;color:#fff;padding:6px 14px;font-size:13px;font-weight:700}
    .client-table{width:100%;border-collapse:collapse;font-size:12px}
    .client-table tr{border-bottom:1px solid #e5e5e5}
    .client-table tr:last-child{border-bottom:none}
    .client-table td{padding:5px 10px;vertical-align:top}
    .lbl{font-weight:700;color:#333;white-space:nowrap}
    .val{color:#111}
    /* Seller block */
    .seller-block{border:1px solid #ccc;border-radius:6px;padding:8px 14px;margin-bottom:16px;font-size:12px}
    /* Desc */
    .desc-box{background:#f8f9fa;border:1px solid #e9ecef;border-radius:8px;padding:18px 20px;margin-bottom:20px}
    .desc-label{font-size:10px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}
    .desc-text{font-size:14px;line-height:1.7;color:#222;white-space:pre-wrap}
    /* Amount */
    .amount-box{background:#1AAF54;border-radius:10px;padding:18px 24px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center}
    .amount-label{font-size:12px;color:rgba(255,255,255,.8);font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
    .amount-value{font-size:30px;font-weight:800;color:#fff;letter-spacing:-.5px}
    .amount-badge{background:rgba(255,255,255,.2);border-radius:8px;padding:8px 16px;font-size:13px;color:#fff;font-weight:600}
    /* Terms */
    .terms{display:flex;gap:16px;margin-bottom:20px;flex-wrap:wrap}
    .term-box{flex:1;min-width:130px;border:1px solid #e9ecef;border-radius:8px;padding:10px 14px}
    .term-label{font-size:10px;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:4px}
    .term-value{font-size:13px;font-weight:600}
    /* Notes */
    .notes-block{border:1px solid #ccc;border-radius:6px;margin-bottom:20px;overflow:hidden}
    .notes-title{background:#333;color:#fff;padding:6px 14px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
    .notes-text{padding:12px 14px;font-size:12px;line-height:1.7;white-space:pre-wrap;color:#222}
    /* Sigs */
    .sigs{display:flex;gap:32px;margin-bottom:24px}
    .sig{flex:1;border-top:1px solid #ddd;padding-top:8px;font-size:11px;color:#999}
    .footer-doc{border-top:1px solid #e9ecef;padding-top:12px;text-align:center;font-size:11px;color:#bbb}
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
      <div class="toolbar-title">Pré-visualização do Orçamento — Nº ${quoteNum}</div>
      <div class="toolbar-sub">Confira o documento abaixo e clique em Imprimir para salvar como PDF</div>
    </div>
    <button class="btn-print" onclick="window.print()">🖨 Imprimir / Gerar PDF</button>
  </div>

  <div class="page">
    <!-- Cabeçalho da empresa -->
    <div class="header">
      <div class="header-left">
        ${logoHtml}
        <div>
          <div class="company-name">${esc(company?.name) || "GestorX7"}</div>
          ${companyInfo}
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:20px;font-weight:700;color:#111">ORÇAMENTO</div>
        <div style="font-size:13px;color:#1AAF54;font-weight:600">Nº ${quoteNum}</div>
        <div style="font-size:11px;color:#888;margin-top:4px">Emitido: ${fmt(issued)}</div>
        <div style="font-size:11px;color:#e67e00">Válido até: ${fmt(valid)}</div>
      </div>
    </div>

    <!-- Dados do cliente -->
    ${clientBlock}

    <!-- Vendedor -->
    ${sellerBlock}

    <!-- Produtos / Descrição -->
    <div class="desc-box">
      <div class="desc-label">Descrição do Serviço / Produto</div>
      <div class="desc-text">${esc(quote.description)}</div>
    </div>

    <!-- Valor total -->
    ${(() => {
      const sub = quote.subtotal != null ? Number(quote.subtotal) : null;
      const disc = quote.discount != null ? Number(quote.discount) : null;
      const hasDisc = sub != null && disc != null && disc > 0;
      if (hasDisc) {
        const pct = sub! > 0 ? ((disc! / sub!) * 100).toFixed(1) : "0";
        return `<div class="amount-box" style="flex-direction:column;align-items:stretch;gap:4px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:11px;color:#888">Subtotal</div>
        <div style="font-size:13px;color:#555">${fmtMoney(sub!)}</div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:11px;color:#c0392b">Desconto (${pct}%)</div>
        <div style="font-size:13px;color:#c0392b;font-weight:600">− ${fmtMoney(disc!)}</div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;border-top:2px solid rgba(0,0,0,.08);padding-top:6px;margin-top:2px">
        <div>
          <div class="amount-label">Valor Total</div>
        </div>
        <div style="display:flex;align-items:center;gap:16px">
          <div class="amount-value">${fmtMoney(quote.amount)}</div>
          <div class="amount-badge" style="color:#fff">${statusLbl}</div>
        </div>
      </div>
    </div>`;
      }
      return `<div class="amount-box">
      <div>
        <div class="amount-label">Valor Total</div>
        <div class="amount-value">${fmtMoney(quote.amount)}</div>
      </div>
      <div class="amount-badge" style="color:#fff">${statusLbl}</div>
    </div>`;
    })()}

    <!-- Condições -->
    <div class="terms">
      <div class="term-box">
        <div class="term-label">Validade</div>
        <div class="term-value">30 dias</div>
      </div>
      <div class="term-box">
        <div class="term-label">Status</div>
        <div class="term-value" style="color:${statusColor}">${statusLbl}</div>
      </div>
      <div class="term-box" style="flex:2;min-width:200px">
        <div class="term-label">Condições de pagamento</div>
        <div class="term-value">A combinar</div>
      </div>
    </div>

    <!-- Dados Adicionais -->
    ${notesBlock}

    <!-- Assinaturas -->
    <div class="sigs">
      <div class="sig">Assinatura do Cliente</div>
      <div class="sig">Assinatura da Empresa</div>
    </div>

    <div class="footer-doc">Orçamento gerado pelo GestorX7 · Obrigado pela preferência!</div>
  </div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=800");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
}

function DiscountCalculator({ form }: { form: ReturnType<typeof useForm<QuoteForm>> }) {
  const [discountPct, setDiscountPct] = useState<string>("");
  const [discountAmt, setDiscountAmt] = useState<string>("");
  const [mode, setMode] = useState<"pct" | "amt">("pct");
  const [applied, setApplied] = useState(false);

  const currentAmount = useWatch({ control: form.control, name: "amount" }) ?? 0;

  // Reset applied state when amount changes manually
  useEffect(() => { setApplied(false); }, [currentAmount]);

  const pctNum = parseFloat(discountPct.replace(",", ".")) || 0;
  const amtNum = parseFloat(discountAmt.replace(",", ".")) || 0;

  const discountValue = mode === "pct"
    ? (currentAmount * pctNum) / 100
    : amtNum;
  const finalAmount = Math.max(0, currentAmount - discountValue);
  const effectivePct = currentAmount > 0 ? (discountValue / currentAmount) * 100 : 0;

  const hasDiscount = discountValue > 0 && currentAmount > 0;

  const apply = () => {
    if (!hasDiscount) return;
    form.setValue("subtotal", parseFloat(currentAmount.toFixed(2)));
    form.setValue("discount", parseFloat(discountValue.toFixed(2)));
    form.setValue("amount", parseFloat(finalAmount.toFixed(2)), { shouldValidate: true });
    setApplied(true);
    setDiscountPct("");
    setDiscountAmt("");
  };

  return (
    <div className="rounded-xl border border-dashed border-primary/30 bg-primary/3 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Tag className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold text-primary uppercase tracking-wide">Calculadora de Desconto</span>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 bg-muted rounded-lg p-0.5">
        <button type="button" onClick={() => { setMode("pct"); setDiscountAmt(""); }}
          className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-all ${mode === "pct" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
          % Porcentagem
        </button>
        <button type="button" onClick={() => { setMode("amt"); setDiscountPct(""); }}
          className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-all ${mode === "amt" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
          R$ Valor fixo
        </button>
      </div>

      {/* Input */}
      <div className="flex gap-2 items-center">
        {mode === "pct" ? (
          <div className="relative flex-1">
            <Input
              type="number" min="0" max="100" step="0.1" placeholder="0"
              value={discountPct}
              onChange={(e) => { setDiscountPct(e.target.value); setApplied(false); }}
              className="pr-8 text-sm"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">%</span>
          </div>
        ) : (
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">R$</span>
            <Input
              type="number" min="0" step="0.01" placeholder="0,00"
              value={discountAmt}
              onChange={(e) => { setDiscountAmt(e.target.value); setApplied(false); }}
              className="pl-9 text-sm"
            />
          </div>
        )}
        <Button
          type="button"
          size="sm"
          disabled={!hasDiscount || applied}
          onClick={apply}
          className="shrink-0 gap-1"
        >
          {applied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Calculator className="w-3.5 h-3.5" />}
          {applied ? "Aplicado!" : "Aplicar"}
        </Button>
      </div>

      {/* Preview */}
      {hasDiscount && !applied && (
        <div className="bg-card rounded-lg px-3 py-2 space-y-1 border">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Valor original</span>
            <span>{formatCurrency(currentAmount)}</span>
          </div>
          <div className="flex justify-between text-xs text-destructive font-medium">
            <span>Desconto ({effectivePct.toFixed(1)}%)</span>
            <span>− {formatCurrency(discountValue)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-primary border-t pt-1 mt-1">
            <span>Valor final</span>
            <span>{formatCurrency(finalAmount)}</span>
          </div>
        </div>
      )}
      {applied && (
        <p className="text-xs text-primary font-medium flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Desconto aplicado — valor atualizado para {formatCurrency(currentAmount)}
        </p>
      )}
    </div>
  );
}

export default function Quotes() {
  const { confirm: askConfirm, ConfirmDialog } = useConfirm();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editQuote, setEditQuote] = useState<Quote | null>(null);
  const [filter, setFilter] = useState<FilterQ>("all");
  const [search, setSearch] = useState("");
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [commissionPct, setCommissionPct] = useState<number | null>(null);
  // Convert dialog
  const [convertDialogQuote, setConvertDialogQuote] = useState<Quote | null>(null);
  const [convertDebtorEnabled, setConvertDebtorEnabled] = useState(false);
  const [convertDebtorAmount, setConvertDebtorAmount] = useState("");
  const [convertDebtorDate, setConvertDebtorDate] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: company } = useCompanySettings();
  const { data: quotes = [], isLoading } = useListQuotes();
  const { data: clients = [] } = useListClients();
  const { data: inventory = [] } = useQuery<InventoryItem[]>({
    queryKey: ["inventory"],
    queryFn: () => fetch("/api/inventory").then((r) => r.json()),
  });
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["employees"],
    queryFn: () => fetch("/api/employees").then((r) => r.json()),
  });
  const createQuote = useCreateQuote();
  const updateQuote = useUpdateQuote();
  const deleteQuote = useDeleteQuote();
  const convertQuote = useConvertQuoteToSale();

  const form = useForm<QuoteForm>({
    resolver: zodResolver(quoteSchema),
    defaultValues: { amount: 0 },
  });

  useEffect(() => {
    const subtotal = quoteItems.reduce((s, i) => s + i.total, 0);
    form.setValue("amount", subtotal, { shouldValidate: false });
  }, [quoteItems]);

  const addItem = (inv: InventoryItem) => {
    setQuoteItems((prev) => {
      const existing = prev.find((i) => i.inventoryId === inv.id);
      if (existing) {
        return prev.map((i) =>
          i.inventoryId === inv.id
            ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unitPrice }
            : i
        );
      }
      return [...prev, { inventoryId: inv.id, name: inv.name, quantity: 1, unitPrice: inv.price, total: inv.price }];
    });
    setShowProductPicker(false);
    setProductSearch("");
  };

  const updateQty = (inventoryId: number, delta: number) => {
    setQuoteItems((prev) =>
      prev
        .map((i) => {
          if (i.inventoryId !== inventoryId) return i;
          const qty = Math.max(1, i.quantity + delta);
          return { ...i, quantity: qty, total: qty * i.unitPrice };
        })
    );
  };

  const removeItem = (inventoryId: number) => {
    setQuoteItems((prev) => prev.filter((i) => i.inventoryId !== inventoryId));
  };

  const NOTES_KEY = "gestorx7:quote_additional_notes";

  const openCreate = () => {
    setEditQuote(null);
    setQuoteItems([]);
    setProductSearch("");
    setShowProductPicker(false);
    setSelectedEmployeeId(null);
    setCommissionPct(null);
    const savedNotes = localStorage.getItem(NOTES_KEY) ?? "";
    form.reset({ clientId: undefined, employeeId: null, commissionPct: null, subtotal: null, discount: null, amount: 0, additionalNotes: savedNotes });
    setDialogOpen(true);
  };

  const openEdit = (q: Quote) => {
    setEditQuote(q);
    setQuoteItems([]);
    setProductSearch("");
    setShowProductPicker(false);
    setSelectedEmployeeId(q.employeeId ?? null);
    setCommissionPct(q.commissionPct ?? null);
    form.reset({ clientId: q.clientId ?? undefined, employeeId: q.employeeId ?? null, commissionPct: q.commissionPct ?? null, subtotal: q.subtotal ?? null, discount: q.discount ?? null, amount: q.amount, additionalNotes: q.additionalNotes ?? "" });
    setDialogOpen(true);
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListQuotesQueryKey() });
    qc.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetFinancialSummaryQueryKey() });
    qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  const onSubmit = (data: QuoteForm) => {
    let description: string;
    if (quoteItems.length > 0) {
      description = quoteItems
        .map((i) => `${i.quantity}x ${i.name} (${formatCurrency(i.unitPrice)})`)
        .join(" · ");
    } else if (editQuote) {
      description = editQuote.description;
    } else {
      toast({ title: "Adicione ao menos um produto ao orçamento", variant: "destructive" });
      return;
    }
    const amount = data.amount;
    const emp = selectedEmployeeId != null ? employees.find((e) => e.id === selectedEmployeeId) : null;
    const payload = {
      data: {
        clientId: data.clientId,
        employeeId: selectedEmployeeId ?? null,
        sellerName: emp ? emp.name : null,
        commissionPct: commissionPct ?? 0,
        description,
        subtotal: data.subtotal ?? null,
        discount: data.discount ?? null,
        amount,
        additionalNotes: data.additionalNotes || null,
      },
    };
    if (editQuote) {
      updateQuote.mutate({ id: editQuote.id, ...payload }, { onSuccess: () => { invalidate(); setDialogOpen(false); toast({ title: "Orçamento atualizado" }); } });
    } else {
      createQuote.mutate(payload, { onSuccess: () => { invalidate(); setDialogOpen(false); toast({ title: "Orçamento criado" }); } });
    }
  };

  const handleConvert = (quote: Quote) => {
    setConvertDialogQuote(quote);
    setConvertDebtorEnabled(false);
    setConvertDebtorAmount(String(quote.amount.toFixed(2)));
    setConvertDebtorDate("");
  };

  const confirmConvert = async () => {
    if (!convertDialogQuote) return;
    convertQuote.mutate({ id: convertDialogQuote.id }, {
      onSuccess: async () => {
        if (convertDebtorEnabled && convertDialogQuote.clientId) {
          const amt = parseFloat(convertDebtorAmount.replace(",", "."));
          if (amt > 0) {
            await fetch(`/api/clients/${convertDialogQuote.clientId}/mark-debtor`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ debtAmount: amt, debtDueDate: convertDebtorDate || null }),
            });
            qc.invalidateQueries({ queryKey: ["clients"] });
          }
        }
        invalidate();
        toast({ title: "Orçamento convertido em venda!" + (convertDebtorEnabled && convertDialogQuote.clientId ? " · Cliente registrado como devedor" : "") });
        setConvertDialogQuote(null);
      },
    });
  };

  const handleDelete = async (id: number) => {
    if (!await askConfirm({ title: "Excluir orçamento", description: "Tem certeza que deseja excluir este orçamento? Esta ação não pode ser desfeita.", confirmText: "Excluir", variant: "destructive" })) return;
    deleteQuote.mutate({ id }, { onSuccess: () => { invalidate(); toast({ title: "Orçamento removido" }); } });
  };

  const typedQuotes = quotes as Quote[];
  const sq = search.toLowerCase();
  const filtered = typedQuotes.filter((q) => {
    if (filter !== "all" && q.status !== filter) return false;
    if (!sq) return true;
    return (
      q.description.toLowerCase().includes(sq) ||
      (q.clientName ?? "").toLowerCase().includes(sq) ||
      (q.sellerName ?? "").toLowerCase().includes(sq)
    );
  });
  const pendingCount = typedQuotes.filter((q) => q.status === "pending").length;
  const totalPending = typedQuotes.filter((q) => q.status === "pending").reduce((s, q) => s + q.amount, 0);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto animate-fade-in">
      {ConfirmDialog}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Orçamentos</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {pendingCount} pendentes
            {totalPending > 0 && <span className="text-primary font-medium"> · {formatCurrency(totalPending)} em aberto</span>}
          </p>
        </div>
        <Button onClick={() => openCreate()} size="sm">
          <Plus className="w-4 h-4 mr-1" />
          <span className="hidden sm:inline">Novo Orçamento</span>
          <span className="sm:hidden">Novo</span>
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por descrição, cliente ou responsável..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded">
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {(["all", "pending", "converted", "rejected"] as FilterQ[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs sm:text-sm rounded-full font-medium transition-all whitespace-nowrap shrink-0 ${
              filter === f ? "bg-primary text-white shadow-sm" : "bg-card border text-muted-foreground hover:text-foreground"
            }`}>
            {f === "all" ? "Todos" : statusLabel[f]}
          </button>
        ))}
      </div>

      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-25" />
            <p className="text-sm">Nenhum orçamento nesta categoria</p>
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((quote) => (
              <div key={quote.id} className="flex items-start gap-3 px-4 py-4 hover:bg-muted/20 transition-colors">
                <div className="p-2 bg-muted rounded-lg shrink-0 mt-0.5">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight">{quote.description}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                    {quote.clientName && <span className="font-medium text-foreground">{quote.clientName}</span>}
                    {quote.sellerName && <span className="text-blue-600 font-medium">· {quote.sellerName}</span>}
                    <span>{formatDate(quote.createdAt)}</span>
                    <span className={`px-2 py-0.5 rounded-full font-semibold ${statusStyle[quote.status]}`}>
                      {statusLabel[quote.status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-base font-bold">{formatCurrency(quote.amount)}</p>
                    {quote.commissionPct != null && quote.commissionPct > 0 && (
                      <span className="text-xs text-primary font-semibold bg-primary/10 px-2 py-0.5 rounded-full">
                        Comissão {quote.commissionPct}% · {formatCurrency(quote.commissionAmount ?? 0)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 shrink-0">
                  {quote.status === "pending" && (
                    <>
                      <button onClick={() => handleConvert(quote)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-primary text-white text-xs rounded-lg hover:bg-primary/90 active:scale-95 transition-all font-medium whitespace-nowrap">
                        <ShoppingCart className="w-3 h-3" />
                        <span className="hidden sm:inline">Converter</span>
                        <span className="sm:hidden">Venda</span>
                      </button>
                      <button onClick={() => openEdit(quote)} className="p-1.5 hover:bg-muted rounded-lg transition-colors active:scale-95">
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => openPrintWindow(quote, company, quote.clientId ? (clients as FullClient[]).find((c) => c.id === quote.clientId) : null)}
                    title="Imprimir / Gerar PDF"
                    className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors active:scale-95"
                  >
                    <Printer className="w-3.5 h-3.5 text-blue-500" />
                  </button>
                  <button onClick={() => handleDelete(quote.id)} className="p-1.5 hover:bg-destructive/10 rounded-lg transition-colors active:scale-95">
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editQuote ? "Editar Orçamento" : "Novo Orçamento"}</DialogTitle>
            <DialogDescription>Selecione os produtos do estoque para este orçamento.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Cliente */}
              <FormField control={form.control} name="clientId" render={({ field }) => (
                <FormItem><FormLabel>Cliente (opcional)</FormLabel>
                  <Select onValueChange={(v) => field.onChange(v === "none" ? undefined : parseInt(v))} defaultValue={editQuote?.clientId ? String(editQuote.clientId) : "none"}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecionar cliente..." /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {(clients as any[]).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />

              {/* Responsável (funcionário) */}
              {employees.length > 0 && (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Responsável (opcional)</label>
                  <div className="flex gap-2">
                    <select
                      value={selectedEmployeeId ?? ""}
                      onChange={(e) => {
                        const id = e.target.value ? Number(e.target.value) : null;
                        setSelectedEmployeeId(id);
                        if (id) {
                          const emp = employees.find((emp) => emp.id === id);
                          setCommissionPct(emp ? emp.commissionRate : null);
                        } else {
                          setCommissionPct(null);
                        }
                      }}
                      className="flex-1 border rounded-lg px-3 py-2 text-sm bg-background outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Nenhum responsável</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>{emp.name} — {emp.role}</option>
                      ))}
                    </select>
                    {selectedEmployeeId != null && (
                      <div className="flex items-center gap-1.5 border rounded-lg px-3 bg-muted/30">
                        <label className="text-xs text-muted-foreground whitespace-nowrap">Comissão %</label>
                        <input
                          type="number" min={0} max={100} step={0.1}
                          value={commissionPct ?? ""}
                          onChange={(e) => setCommissionPct(e.target.value ? parseFloat(e.target.value) : null)}
                          className="w-16 text-sm bg-transparent outline-none text-right font-medium"
                          placeholder="0"
                        />
                      </div>
                    )}
                  </div>
                  {selectedEmployeeId != null && commissionPct != null && commissionPct > 0 && (
                    <p className="text-xs text-primary mt-1 font-medium">
                      Comissão estimada: {formatCurrency((form.watch("amount") ?? 0) * commissionPct / 100)}
                    </p>
                  )}
                </div>
              )}

              {/* Product Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Produtos</span>
                  <span className="text-xs text-muted-foreground">{quoteItems.length} item(s)</span>
                </div>

                {/* Items list */}
                {quoteItems.length > 0 && (
                  <div className="border rounded-xl divide-y overflow-hidden">
                    {quoteItems.map((item) => (
                      <div key={item.inventoryId} className="flex items-center gap-2 px-3 py-2.5 bg-card">
                        <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{formatCurrency(item.unitPrice)}/un</p>
                        </div>
                        {/* Qty stepper */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button type="button"
                            onClick={() => updateQty(item.inventoryId, -1)}
                            className="w-6 h-6 rounded-full border flex items-center justify-center text-sm font-bold hover:bg-muted disabled:opacity-30"
                            disabled={item.quantity <= 1}>
                            −
                          </button>
                          <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                          <button type="button"
                            onClick={() => updateQty(item.inventoryId, 1)}
                            className="w-6 h-6 rounded-full border flex items-center justify-center text-sm font-bold hover:bg-muted">
                            +
                          </button>
                        </div>
                        <span className="text-sm font-bold text-primary w-20 text-right shrink-0">{formatCurrency(item.total)}</span>
                        <button type="button" onClick={() => removeItem(item.inventoryId)}
                          className="p-1 hover:bg-destructive/10 rounded-lg transition-colors">
                          <X className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    ))}
                    {/* Subtotal row */}
                    <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Subtotal</span>
                      <span className="text-sm font-bold">{formatCurrency(quoteItems.reduce((s, i) => s + i.total, 0))}</span>
                    </div>
                  </div>
                )}

                {/* Edit mode hint */}
                {editQuote && quoteItems.length === 0 && (
                  <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2.5">
                    <p className="text-xs text-amber-700 font-medium">Descrição atual:</p>
                    <p className="text-xs text-amber-800 mt-0.5">{editQuote.description}</p>
                    <p className="text-xs text-amber-600 mt-1">Adicione produtos para substituir, ou salve sem alterar.</p>
                  </div>
                )}

                {/* Add product button / picker */}
                <div className="relative">
                  <button type="button"
                    onClick={() => { setShowProductPicker((v) => !v); setProductSearch(""); }}
                    className="w-full py-2 border-2 border-dashed border-primary/30 rounded-xl text-sm text-primary/70 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-1.5">
                    <Plus className="w-4 h-4" />
                    Adicionar produto do estoque
                  </button>

                  {showProductPicker && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border rounded-xl shadow-xl overflow-hidden">
                      <div className="p-2 border-b">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                          <Input
                            autoFocus
                            placeholder="Buscar produto..."
                            className="pl-8 h-8 text-sm"
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {(inventory as InventoryItem[])
                          .filter((inv) => inv.name.toLowerCase().includes(productSearch.toLowerCase()))
                          .map((inv) => (
                            <button key={inv.id} type="button"
                              onClick={() => addItem(inv)}
                              className="w-full text-left px-3 py-2.5 hover:bg-muted/50 text-sm flex items-center justify-between gap-2 border-b last:border-0">
                              <span className="font-medium truncate">{inv.name}</span>
                              <span className="text-xs text-primary font-semibold shrink-0">{formatCurrency(inv.price)}</span>
                            </button>
                          ))}
                        {(inventory as InventoryItem[]).filter((inv) => inv.name.toLowerCase().includes(productSearch.toLowerCase())).length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">Nenhum produto encontrado</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Discount calculator (only when there are items) */}
              {quoteItems.length > 0 && <DiscountCalculator form={form} />}

              {/* Dados Adicionais */}
              <FormField control={form.control} name="additionalNotes" render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Dados Adicionais (opcional)</FormLabel>
                    <span className="text-[10px] text-muted-foreground">Salvo automaticamente</span>
                  </div>
                  <FormControl>
                    <textarea
                      {...field}
                      rows={3}
                      placeholder="Ex: Orçamento válido por 3 dias · Consultar forma de pagamento e prazo de entrega..."
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-background outline-none focus:ring-1 focus:ring-primary resize-none"
                      onChange={(e) => {
                        field.onChange(e);
                        localStorage.setItem(NOTES_KEY, e.target.value);
                      }}
                    />
                  </FormControl>
                </FormItem>
              )} />

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1 sm:flex-none">Cancelar</Button>
                <Button type="submit" disabled={createQuote.isPending || updateQuote.isPending} className="flex-1 sm:flex-none">
                  {editQuote ? "Salvar" : "Criar Orçamento"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog de Conversão em Venda ──────────────────────────── */}
      <Dialog open={!!convertDialogQuote} onOpenChange={(o) => { if (!o) setConvertDialogQuote(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary" />
              Converter em Venda
            </DialogTitle>
            <DialogDescription>
              {convertDialogQuote?.clientName
                ? `Orçamento de ${convertDialogQuote.clientName} — ${formatCurrency(convertDialogQuote?.amount ?? 0)}`
                : `Valor: ${formatCurrency(convertDialogQuote?.amount ?? 0)}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Opção devedor — só exibe se o orçamento tem cliente cadastrado */}
            {convertDialogQuote?.clientId ? (
              <div className="border rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setConvertDebtorEnabled((v) => !v)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${convertDebtorEnabled ? "bg-amber-50 text-amber-800 border-b border-amber-200" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"}`}
                >
                  <AlertTriangle className={`w-4 h-4 shrink-0 ${convertDebtorEnabled ? "text-amber-600" : "text-muted-foreground"}`} />
                  <span className="flex-1 text-left">Cliente vai pagar depois (registrar como devedor)</span>
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${convertDebtorEnabled ? "bg-amber-500 border-amber-500" : "border-muted-foreground/40"}`}>
                    {convertDebtorEnabled && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </div>
                </button>
                {convertDebtorEnabled && (
                  <div className="px-4 py-3 bg-amber-50/50 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-amber-800 mb-1 block">Valor da dívida (R$)</label>
                        <input
                          type="number" min={0.01} step={0.01}
                          value={convertDebtorAmount}
                          onChange={(e) => setConvertDebtorAmount(e.target.value)}
                          className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white outline-none focus:ring-1 focus:ring-amber-400"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-amber-800 mb-1 block">Data prometida de pagamento</label>
                        <input
                          type="date"
                          value={convertDebtorDate}
                          onChange={(e) => setConvertDebtorDate(e.target.value)}
                          className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white outline-none focus:ring-1 focus:ring-amber-400"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-amber-700">Isso ficará registrado no cadastro do cliente e aparecerá nos alertas do sistema.</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                Nenhum cliente cadastrado vinculado. Para registrar devedor, vincule um cliente ao orçamento.
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConvertDialogQuote(null)}>Cancelar</Button>
            <Button onClick={confirmConvert} disabled={convertQuote.isPending} className="gap-1.5">
              <ShoppingCart className="w-4 h-4" />
              {convertQuote.isPending ? "Convertendo..." : "Confirmar Conversão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
