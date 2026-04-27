import { useState } from "react";
import { useConfirm } from "@/hooks/use-confirm";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, ShoppingCart, Trash2, Search, Package, Users,
  CreditCard, Banknote, Receipt, TrendingDown, Clock,
  CheckCircle2, XCircle, ChevronDown, Tag, Calendar, X, RotateCcw, Printer, AlertTriangle,
} from "lucide-react";
import { PrintReceiptModal } from "@/components/PrintReceiptModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";

type InventoryItem = {
  id: number; name: string; quantity: number; price: number;
  priceAPrazo: number; costPrice: number; isLowStock: boolean;
};
type Client = { id: number; name: string; phone: string };
type Employee = { id: number; name: string; role: string; commissionRate: number };
type SaleItem = {
  inventoryId: number; name: string; quantity: number; unitPrice: number; total: number;
};
type ReturnItem = {
  inventoryId: number; name: string; quantity: number; unitPrice: number; total: number;
};
type Sale = {
  id: number; clientId?: number | null; clientName?: string | null;
  employeeId?: number | null; sellerName?: string | null; commissionPct?: number | null;
  items: SaleItem[]; paymentType: string; paymentMethod: string;
  installments: number; subtotal: number; discount: number; total: number;
  notes?: string | null; createdAt: string;
  returnedItems?: ReturnItem[] | null; returnTotal?: number | null; returnedAt?: string | null;
};

const PAYMENT_METHODS = [
  { value: "pix",           label: "PIX",       icon: Banknote },
  { value: "cartao_credito",label: "Crédito",    icon: CreditCard },
  { value: "cartao_debito", label: "Débito",     icon: CreditCard },
  { value: "dinheiro",      label: "Dinheiro",   icon: Banknote },
  { value: "boleto",        label: "Boleto",     icon: Receipt },
  { value: "crediario",     label: "Crediário",  icon: TrendingDown },
] as const;
type PaymentMethod = typeof PAYMENT_METHODS[number]["value"];
const METHOD_LABEL: Record<string, string> = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, m.label]));

// ─── ReturnDialog ─────────────────────────────────────────────────────────────
function ReturnDialog({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const qc = useQueryClient();
  const [quantities, setQuantities] = useState<Record<number, number>>(() => {
    const init: Record<number, number> = {};
    sale.items.forEach((it) => { init[it.inventoryId] = 0; });
    return init;
  });

  const alreadyReturnedMap = (() => {
    const m: Record<number, number> = {};
    (sale.returnedItems ?? []).forEach((r) => { m[r.inventoryId] = (m[r.inventoryId] ?? 0) + r.quantity; });
    return m;
  })();

  const maxMap: Record<number, number> = {};
  sale.items.forEach((it) => {
    maxMap[it.inventoryId] = it.quantity - (alreadyReturnedMap[it.inventoryId] ?? 0);
  });

  const returnMutation = useMutation({
    mutationFn: async (items: { inventoryId: number; name: string; quantity: number; unitPrice: number; total: number }[]) => {
      const res = await fetch(`/api/product-sales/${sale.id}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Erro na devolução"); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product-sales"] });
      onClose();
    },
  });

  const selectedItems = sale.items
    .map((it) => ({
      inventoryId: it.inventoryId,
      name: it.name,
      unitPrice: it.unitPrice,
      quantity: quantities[it.inventoryId] ?? 0,
      maxQty: maxMap[it.inventoryId],
    }))
    .filter((it) => it.quantity > 0);

  const handleSubmit = () => {
    if (selectedItems.length === 0) return;
    returnMutation.mutate(
      selectedItems.map((it) => ({
        inventoryId: it.inventoryId,
        name: it.name,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        total: it.quantity * it.unitPrice,
      }))
    );
  };

  const totalReturnValue = sale.items.reduce((s, it) => {
    const q = quantities[it.inventoryId] ?? 0;
    return s + q * it.unitPrice;
  }, 0);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-primary" />
            Devolução — Venda #{sale.id}
          </DialogTitle>
          <DialogDescription>Selecione os itens e quantidades a devolver. O estoque será reabastecido automaticamente.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 my-2">
          {sale.items.map((it) => {
            const already = alreadyReturnedMap[it.inventoryId] ?? 0;
            const max = maxMap[it.inventoryId];
            const qty = quantities[it.inventoryId] ?? 0;
            const fullyReturned = max <= 0;
            return (
              <div key={it.inventoryId} className={`p-3 rounded-lg border ${fullyReturned ? "bg-muted/50 opacity-60" : "bg-card"}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{it.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      Vendido: {it.quantity} un · {fmt(it.unitPrice)}/un
                      {already > 0 && <span className="text-amber-600"> · Devolvido: {already}</span>}
                    </div>
                  </div>
                  {fullyReturned ? (
                    <span className="text-[11px] text-muted-foreground shrink-0">Devolvido</span>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        className="w-7 h-7 rounded-full border flex items-center justify-center text-base font-bold hover:bg-muted disabled:opacity-30"
                        disabled={qty <= 0}
                        onClick={() => setQuantities((p) => ({ ...p, [it.inventoryId]: Math.max(0, qty - 1) }))}
                      >−</button>
                      <span className="w-6 text-center text-sm font-bold">{qty}</span>
                      <button
                        type="button"
                        className="w-7 h-7 rounded-full border flex items-center justify-center text-base font-bold hover:bg-muted disabled:opacity-30"
                        disabled={qty >= max}
                        onClick={() => setQuantities((p) => ({ ...p, [it.inventoryId]: Math.min(max, qty + 1) }))}
                      >+</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {returnMutation.isError && (
          <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
            {(returnMutation.error as Error).message}
          </div>
        )}

        {selectedItems.length > 0 && (
          <div className="text-sm font-semibold text-center py-1">
            Valor a estornar: <span className="text-primary">{fmt(totalReturnValue)}</span>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={returnMutation.isPending}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={selectedItems.length === 0 || returnMutation.isPending}>
            {returnMutation.isPending ? "Processando…" : "Confirmar Devolução"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── SaleDialog ──────────────────────────────────────────────────────────────
function SaleDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: inventory = [] } = useQuery<InventoryItem[]>({
    queryKey: ["inventory-for-sale"],
    queryFn: () => fetch("/api/inventory").then((r) => r.json()),
  });
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["clients-for-sale"],
    queryFn: () => fetch("/api/clients").then((r) => r.json()),
  });
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["employees-for-sale"],
    queryFn: () => fetch("/api/employees").then((r) => r.json()),
  });

  // State
  const [paymentType, setPaymentType] = useState<"avista" | "aprazo">("avista");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("dinheiro");
  const [installments, setInstallments] = useState(1);
  const [discountMode, setDiscountMode] = useState<"pct" | "amt">("amt");
  const [discountInput, setDiscountInput] = useState("");
  const [valorPago, setValorPago] = useState("");
  const [notes, setNotes] = useState("");
  const [clientMode, setClientMode] = useState<"registered" | "free">("registered");
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [freeClientName, setFreeClientName] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [clientDropOpen, setClientDropOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [commissionPct, setCommissionPct] = useState<number | null>(null);
  const [items, setItems] = useState<SaleItem[]>([
    { inventoryId: 0, name: "", quantity: 1, unitPrice: 0, total: 0 },
  ]);
  const [productSearch, setProductSearch] = useState<string[]>([""]);
  const [productDropOpen, setProductDropOpen] = useState<boolean[]>([false]);
  const [debtorEnabled, setDebtorEnabled] = useState(false);
  const [debtorAmount, setDebtorAmount] = useState("");
  const [debtorDate, setDebtorDate] = useState("");

  const showInstallments = paymentMethod === "cartao_credito" || paymentMethod === "crediario" || paymentType === "aprazo";

  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const discountInputNum = parseFloat(discountInput.replace(",", ".")) || 0;
  const discount = discountMode === "pct"
    ? Math.min(subtotal, (subtotal * discountInputNum) / 100)
    : Math.min(subtotal, discountInputNum);
  const discountPct = subtotal > 0 ? (discount / subtotal) * 100 : 0;
  const total = Math.max(0, subtotal - discount);

  const filteredClients = clients.filter((c: Client) =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) || c.phone.includes(clientSearch)
  );

  // Get price based on payment type
  const getUnitPrice = (inv: InventoryItem, type: "avista" | "aprazo" = paymentType) =>
    type === "aprazo" && inv.priceAPrazo > 0 ? inv.priceAPrazo : inv.price;

  // When payment type changes, re-price all existing items immediately (no useEffect needed)
  const handlePaymentTypeChange = (type: "avista" | "aprazo") => {
    setPaymentType(type);
    setItems((prev) =>
      prev.map((item) => {
        if (item.inventoryId === 0) return item;
        const inv = inventory.find((i) => i.id === item.inventoryId);
        if (!inv) return item;
        const unitPrice = getUnitPrice(inv, type);
        return { ...item, unitPrice, total: unitPrice * item.quantity };
      })
    );
  };

  const selectProduct = (idx: number, inv: InventoryItem) => {
    const unitPrice = getUnitPrice(inv);
    setItems((prev) => {
      const updated = [...prev];
      updated[idx] = {
        inventoryId: inv.id, name: inv.name, quantity: 1,
        unitPrice, total: unitPrice,
      };
      return updated;
    });
    const newSearch = [...productSearch]; newSearch[idx] = inv.name; setProductSearch(newSearch);
    const newOpen = [...productDropOpen]; newOpen[idx] = false; setProductDropOpen(newOpen);
  };

  const updateItemQty = (idx: number, qty: number) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], quantity: qty, total: updated[idx].unitPrice * qty };
      return updated;
    });
  };

  const updateItemPrice = (idx: number, price: number) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], unitPrice: price, total: price * updated[idx].quantity };
      return updated;
    });
  };

  const addItem = () => {
    setItems((p) => [...p, { inventoryId: 0, name: "", quantity: 1, unitPrice: 0, total: 0 }]);
    setProductSearch((p) => [...p, ""]);
    setProductDropOpen((p) => [...p, false]);
  };

  const removeItem = (idx: number) => {
    setItems((p) => p.filter((_, i) => i !== idx));
    setProductSearch((p) => p.filter((_, i) => i !== idx));
    setProductDropOpen((p) => p.filter((_, i) => i !== idx));
  };

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      const r = await fetch("/api/product-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || "Erro ao registrar venda"); }
      const sale = await r.json();
      // Se devedor habilitado e cliente registrado, registra dívida
      if (debtorEnabled && clientMode === "registered" && selectedClientId) {
        const amt = parseFloat(debtorAmount.replace(",", "."));
        if (amt > 0) {
          await fetch(`/api/clients/${selectedClientId}/mark-debtor`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ debtAmount: amt, debtDueDate: debtorDate || null }),
          });
        }
      }
      return sale;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product-sales"] });
      qc.invalidateQueries({ queryKey: ["inventory-for-sale"] });
      qc.invalidateQueries({ queryKey: ["financial-transactions-report"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      const debtorMsg = debtorEnabled && clientMode === "registered" && selectedClientId ? " · Cliente registrado como devedor" : "";
      toast({ title: "✅ Venda registrada!", description: `${formatCurrency(total)} · ${items.length} produto(s)${debtorMsg}` });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const submit = () => {
    const validItems = items.filter((i) => i.inventoryId > 0 && i.quantity > 0);
    if (validItems.length === 0) {
      toast({ title: "Adicione pelo menos um produto", variant: "destructive" }); return;
    }
    const clientName = clientMode === "registered"
      ? (clients.find((c: Client) => c.id === selectedClientId)?.name ?? null)
      : (freeClientName.trim() || null);

    mutation.mutate({
      clientId: clientMode === "registered" ? selectedClientId : null,
      clientName,
      employeeId: selectedEmployeeId,
      commissionPct: selectedEmployeeId != null ? commissionPct : null,
      items: validItems,
      paymentType,
      paymentMethod,
      installments: showInstallments ? installments : 1,
      subtotal,
      discount,
      total,
      notes: notes.trim() || null,
    });
  };

  return (
    <DialogContent className="max-w-2xl mx-auto max-h-[92vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-primary" />
          Nova Venda
        </DialogTitle>
        <DialogDescription>Registre uma nova venda com produtos, cliente e forma de pagamento.</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        {/* ── Cliente ────────────────────────────────────────────────── */}
        <div>
          <label className="text-sm font-medium mb-1.5 block">Cliente (opcional)</label>
          <div className="flex gap-1.5 mb-2">
            {(["registered", "free"] as const).map((m) => (
              <button key={m} onClick={() => setClientMode(m)}
                className={`px-3 py-1.5 text-sm rounded-lg border font-medium transition-all ${clientMode === m ? "bg-primary text-white border-primary" : "bg-muted/40 text-muted-foreground"}`}>
                {m === "registered" ? "Cadastrado" : "Nome avulso"}
              </button>
            ))}
          </div>
          {clientMode === "registered" ? (
            <div className="relative">
              <div
                className="flex items-center gap-2 px-3 py-2 border rounded-lg bg-background cursor-pointer hover:bg-muted/30"
                onClick={() => setClientDropOpen((p) => !p)}
              >
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className={`flex-1 text-sm ${selectedClientId ? "text-foreground" : "text-muted-foreground"}`}>
                  {selectedClientId ? clients.find((c: Client) => c.id === selectedClientId)?.name : "Selecionar cliente..."}
                </span>
                {selectedClientId && (
                  <button onClick={(e) => { e.stopPropagation(); setSelectedClientId(null); setClientSearch(""); }}
                    className="p-0.5 hover:bg-muted rounded">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </div>
              {clientDropOpen && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-card border rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
                  <div className="p-2 border-b sticky top-0 bg-card">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <input
                        className="w-full pl-7 pr-2 py-1.5 text-sm bg-muted/40 rounded-lg outline-none"
                        placeholder="Buscar..."
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        autoFocus
                      />
                    </div>
                  </div>
                  {filteredClients.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-3">Nenhum cliente</p>
                  ) : filteredClients.map((c: Client) => (
                    <button key={c.id} onClick={() => { setSelectedClientId(c.id); setClientDropOpen(false); setClientSearch(""); }}
                      className={`w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors text-sm ${selectedClientId === c.id ? "bg-primary/10 text-primary font-medium" : ""}`}>
                      {c.name} <span className="text-muted-foreground text-xs">· {c.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Input value={freeClientName} onChange={(e) => setFreeClientName(e.target.value)} placeholder="Nome do cliente..." />
          )}
        </div>

        {/* ── Vendedor ───────────────────────────────────────────────── */}
        {employees.length > 0 && (
          <div>
            <label className="text-sm font-medium mb-1.5 block">Vendedor (opcional)</label>
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
                <option value="">Nenhum vendedor</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} — {emp.role}
                  </option>
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
              <p className="text-xs text-muted-foreground mt-1">
                Comissão estimada: <span className="text-primary font-medium">{formatCurrency((total * commissionPct) / 100)}</span>
              </p>
            )}
          </div>
        )}

        {/* ── Tipo de Pagamento ──────────────────────────────────────── */}
        <div>
          <label className="text-sm font-medium mb-1.5 block">Tipo de Venda</label>
          <div className="flex gap-1.5">
            {([
              { v: "avista", l: "À Vista" },
              { v: "aprazo", l: "A Prazo" },
            ] as const).map(({ v, l }) => (
              <button key={v} onClick={() => handlePaymentTypeChange(v)}
                className={`flex-1 py-2 text-sm rounded-xl border-2 font-semibold transition-all ${paymentType === v ? "border-primary bg-primary/5 text-primary" : "border-muted text-muted-foreground hover:border-primary/30"}`}>
                {l}
              </button>
            ))}
          </div>
          {paymentType === "aprazo" && (
            <p className="text-xs text-muted-foreground mt-1">
              Os preços A Prazo serão aplicados automaticamente aos produtos que os tiverem configurados.
            </p>
          )}
        </div>

        {/* ── Produtos ──────────────────────────────────────────────── */}
        <div>
          <label className="text-sm font-medium mb-1.5 block">Produtos</label>
          <div className="space-y-2">
            {items.map((item, idx) => {
              const avail = item.inventoryId > 0
                ? inventory.find((i) => i.id === item.inventoryId)?.quantity ?? 0
                : null;
              const insufficiente = avail !== null && item.quantity > avail;
              const filtered = inventory.filter((i) =>
                i.quantity > 0 &&
                i.name.toLowerCase().includes((productSearch[idx] ?? "").toLowerCase())
              );
              return (
                <div key={idx} className="p-3 bg-muted/30 border rounded-xl space-y-2">
                  <div className="flex gap-2 items-start">
                    {/* Product selector */}
                    <div className="flex-1 relative">
                      <div className="relative">
                        <Package className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <input
                          className="w-full pl-8 pr-2 py-2 text-sm border rounded-lg bg-background outline-none focus:ring-1 focus:ring-primary"
                          placeholder="Buscar produto..."
                          value={productSearch[idx] ?? ""}
                          onChange={(e) => {
                            const s = [...productSearch]; s[idx] = e.target.value; setProductSearch(s);
                            const o = [...productDropOpen]; o[idx] = true; setProductDropOpen(o);
                          }}
                          onFocus={() => { const o = [...productDropOpen]; o[idx] = true; setProductDropOpen(o); }}
                        />
                      </div>
                      {productDropOpen[idx] && filtered.length > 0 && (
                        <div className="absolute top-full mt-1 left-0 right-0 bg-card border rounded-xl shadow-lg z-50 max-h-40 overflow-y-auto">
                          {filtered.map((inv) => (
                            <button key={inv.id} onClick={() => selectProduct(idx, inv)}
                              className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm flex items-center justify-between gap-2">
                              <div>
                                <span className="font-medium">{inv.name}</span>
                                {inv.isLowStock && <span className="ml-1.5 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">baixo estoque</span>}
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-primary font-semibold text-xs">
                                  {formatCurrency(paymentType === "aprazo" && inv.priceAPrazo > 0 ? inv.priceAPrazo : inv.price)}
                                  {paymentType === "aprazo" && inv.priceAPrazo > 0 && <span className="text-muted-foreground ml-1">prazo</span>}
                                </p>
                                <p className="text-[10px] text-muted-foreground">{inv.quantity} em estoque</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {items.length > 1 && (
                      <button onClick={() => removeItem(idx)} className="p-2 hover:bg-destructive/10 rounded-lg transition-colors shrink-0 mt-0.5">
                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                  {item.inventoryId > 0 && (
                    <div className="flex gap-2 items-center">
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs text-muted-foreground">Qtd:</label>
                        <input
                          type="number" min={1}
                          value={item.quantity}
                          onChange={(e) => updateItemQty(idx, Math.max(1, parseInt(e.target.value) || 1))}
                          className={`w-16 px-2 py-1.5 text-sm border rounded-lg text-center outline-none focus:ring-1 focus:ring-primary ${insufficiente ? "border-destructive bg-destructive/5" : ""}`}
                        />
                        {avail !== null && (
                          <span className={`text-[11px] ${insufficiente ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                            / {avail} disponível
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 ml-auto">
                        <label className="text-xs text-muted-foreground">Preço unit.:</label>
                        <input
                          type="number" min={0} step={0.01}
                          value={item.unitPrice}
                          onChange={(e) => updateItemPrice(idx, parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1.5 text-sm border rounded-lg text-right outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div className="shrink-0">
                        <span className="text-sm font-bold text-primary">{formatCurrency(item.total)}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <button onClick={addItem}
              className="w-full py-2 border-2 border-dashed border-primary/30 rounded-xl text-sm text-primary/70 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Adicionar produto
            </button>
          </div>
        </div>

        {/* ── Forma de Pagamento ─────────────────────────────────────── */}
        <div>
          <label className="text-sm font-medium mb-1.5 block">Forma de Pagamento</label>
          <div className="grid grid-cols-3 gap-1.5">
            {PAYMENT_METHODS.map(({ value, label, icon: Icon }) => (
              <button key={value} onClick={() => setPaymentMethod(value)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${paymentMethod === value ? "bg-primary text-white border-primary" : "bg-muted/30 text-muted-foreground hover:text-foreground border-transparent"}`}>
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Parcelas ──────────────────────────────────────────────── */}
        {showInstallments && (
          <div>
            <label className="text-sm font-medium mb-1.5 block">Parcelas</label>
            <select
              value={installments}
              onChange={(e) => setInstallments(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-background outline-none focus:ring-1 focus:ring-primary"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? "À vista" : `${n}x de ${formatCurrency(total / n)}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* ── Desconto e Resumo ──────────────────────────────────────── */}
        <div className="bg-muted/30 border rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Subtotal</span>
            <span className="text-sm font-medium">{formatCurrency(subtotal)}</span>
          </div>

          {/* Desconto com toggle % / R$ */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Desconto</span>
              {/* Modo toggle */}
              <div className="flex rounded-lg border overflow-hidden bg-background shrink-0">
                <button
                  type="button"
                  onClick={() => { setDiscountMode("pct"); setDiscountInput(""); }}
                  className={`px-2.5 py-1 text-xs font-semibold transition-colors ${discountMode === "pct" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted/40"}`}
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => { setDiscountMode("amt"); setDiscountInput(""); }}
                  className={`px-2.5 py-1 text-xs font-semibold transition-colors ${discountMode === "amt" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted/40"}`}
                >
                  R$
                </button>
              </div>
              <input
                type="number"
                min={0}
                step={discountMode === "pct" ? 0.1 : 0.01}
                max={discountMode === "pct" ? 100 : subtotal}
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                placeholder={discountMode === "pct" ? "0" : "0,00"}
                className="flex-1 px-2 py-1.5 text-sm border rounded-lg text-right outline-none focus:ring-1 focus:ring-primary bg-background"
              />
            </div>
            {discount > 0 && (
              <div className="flex items-center justify-between text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                <span className="flex items-center gap-1">
                  <Tag className="w-3 h-3 text-amber-600" />
                  Desconto aplicado
                </span>
                <span className="font-semibold text-amber-700">
                  −{formatCurrency(discount)} ({discountPct.toFixed(1)}%)
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t pt-2">
            <span className="font-semibold">Total</span>
            <span className="text-lg font-bold text-primary">{formatCurrency(total)}</span>
          </div>

          {/* Troco — só aparece quando pagamento é dinheiro */}
          {paymentMethod === "dinheiro" && (
            <div className="border-t pt-2 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">Valor recebido</span>
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={valorPago}
                    onChange={(e) => setValorPago(e.target.value)}
                    placeholder="0,00"
                    className="w-full pl-8 pr-2 py-1.5 text-sm border rounded-lg text-right outline-none focus:ring-1 focus:ring-primary bg-background"
                  />
                </div>
              </div>
              {(() => {
                const pago = parseFloat(valorPago.replace(",", ".")) || 0;
                const troco = pago - total;
                if (pago <= 0) return null;
                return (
                  <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold ${troco >= 0 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                    <span>{troco >= 0 ? "Troco" : "Valor insuficiente"}</span>
                    <span>{troco >= 0 ? formatCurrency(troco) : `Faltam ${formatCurrency(Math.abs(troco))}`}</span>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* ── Observações ────────────────────────────────────────────── */}
        <div>
          <label className="text-sm font-medium mb-1.5 block">Observações (opcional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border rounded-lg text-sm bg-background outline-none focus:ring-1 focus:ring-primary resize-none"
            placeholder="Anotações sobre a venda..."
          />
        </div>

        {/* ── Registrar como devedor ─────────────────────────────────── */}
        {clientMode === "registered" && selectedClientId && (
          <div className="border rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => { setDebtorEnabled((v) => !v); if (!debtorEnabled) setDebtorAmount(String(total.toFixed(2))); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${debtorEnabled ? "bg-amber-50 text-amber-800 border-b border-amber-200" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"}`}
            >
              <AlertTriangle className={`w-4 h-4 ${debtorEnabled ? "text-amber-600" : "text-muted-foreground"}`} />
              <span className="flex-1 text-left">Cliente vai pagar depois (registrar como devedor)</span>
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${debtorEnabled ? "bg-amber-500 border-amber-500" : "border-muted-foreground/40"}`}>
                {debtorEnabled && <CheckCircle2 className="w-3 h-3 text-white" />}
              </div>
            </button>
            {debtorEnabled && (
              <div className="px-4 py-3 bg-amber-50/50 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-amber-800 mb-1 block">Valor da dívida (R$)</label>
                    <input
                      type="number"
                      min={0.01}
                      step={0.01}
                      value={debtorAmount}
                      onChange={(e) => setDebtorAmount(e.target.value)}
                      className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white outline-none focus:ring-1 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-amber-800 mb-1 block">Data prometida de pagamento</label>
                    <input
                      type="date"
                      value={debtorDate}
                      onChange={(e) => setDebtorDate(e.target.value)}
                      className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white outline-none focus:ring-1 focus:ring-amber-400"
                    />
                  </div>
                </div>
                <p className="text-xs text-amber-700">Isso ficará registrado no cadastro do cliente e aparecerá nos alertas do sistema.</p>
              </div>
            )}
          </div>
        )}
      </div>

      <DialogFooter className="gap-2 mt-2">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={submit} disabled={mutation.isPending} className="gap-1.5">
          <CheckCircle2 className="w-4 h-4" />
          {mutation.isPending ? "Registrando..." : "Registrar Venda"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Vendas() {
  const { confirm: askConfirm, ConfirmDialog } = useConfirm();
  const [newSaleOpen, setNewSaleOpen] = useState(false);
  const [returnSale, setReturnSale] = useState<Sale | null>(null);
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null);
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: sales = [], isLoading } = useQuery<Sale[]>({
    queryKey: ["product-sales"],
    queryFn: () => fetch("/api/product-sales").then((r) => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/product-sales/${id}`, { method: "DELETE" }).then((r) => {
        if (!r.ok && r.status !== 204) throw new Error("Erro ao cancelar");
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product-sales"] });
      qc.invalidateQueries({ queryKey: ["inventory-for-sale"] });
      toast({ title: "Venda cancelada", description: "Estoque restaurado automaticamente" });
    },
    onError: () => toast({ title: "Erro ao cancelar venda", variant: "destructive" }),
  });

  const filtered = sales.filter((s) => {
    const q = search.toLowerCase();
    return (
      (s.clientName ?? "").toLowerCase().includes(q) ||
      s.items.some((i) => i.name.toLowerCase().includes(q))
    );
  });

  const totalVendido = sales.reduce((sum, s) => sum + s.total, 0);
  const ticketMedio = sales.length > 0 ? totalVendido / sales.length : 0;

  const paymentTypeLabel = { avista: "À Vista", aprazo: "A Prazo" } as Record<string, string>;
  const paymentTypeColor = { avista: "text-primary bg-primary/10", aprazo: "text-amber-700 bg-amber-50" } as Record<string, string>;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto animate-fade-in">
      {ConfirmDialog}
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Vendas</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {sales.length} venda{sales.length !== 1 ? "s" : ""} registrada{sales.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => setNewSaleOpen(true)} size="sm">
          <Plus className="w-4 h-4 mr-1" />
          <span className="hidden sm:inline">Nova Venda</span>
          <span className="sm:hidden">Nova</span>
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "Total Vendido", value: formatCurrency(totalVendido), color: "text-primary" },
          { label: "Nº de Vendas", value: String(sales.length), color: "text-foreground" },
          { label: "Ticket Médio", value: formatCurrency(ticketMedio), color: "text-foreground" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border rounded-xl p-3 text-center shadow-sm">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
            <p className={`text-base font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar por cliente ou produto..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* List */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-25" />
            <p className="text-sm">{search ? "Nenhuma venda encontrada" : "Nenhuma venda registrada ainda"}</p>
            {!search && <Button size="sm" className="mt-3" onClick={() => setNewSaleOpen(true)}>Registrar primeira venda</Button>}
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((sale) => (
              <div key={sale.id} className="px-4 py-3.5 hover:bg-muted/25 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-sm">
                    {sale.clientName ? sale.clientName.charAt(0).toUpperCase() : "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">
                        {sale.clientName ?? <span className="text-muted-foreground italic">Cliente não informado</span>}
                      </p>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${paymentTypeColor[sale.paymentType] ?? "text-muted-foreground bg-muted"}`}>
                        {paymentTypeLabel[sale.paymentType] ?? sale.paymentType}
                        {sale.installments > 1 && ` ${sale.installments}x`}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 bg-muted rounded-full text-muted-foreground shrink-0">
                        {METHOD_LABEL[sale.paymentMethod] ?? sale.paymentMethod}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(sale.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {sale.items.map((item, i) => (
                        <span key={i} className="text-[11px] bg-muted/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Package className="w-2.5 h-2.5" />
                          {item.quantity}× {item.name}
                          <span className="text-muted-foreground">· {formatCurrency(item.total)}</span>
                        </span>
                      ))}
                    </div>
                    {sale.discount > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Desconto: <span className="text-destructive">-{formatCurrency(sale.discount)}</span>
                      </p>
                    )}
                    {sale.sellerName && (
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {sale.sellerName}
                        {sale.commissionPct != null && sale.commissionPct > 0 && (
                          <span className="ml-1 bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full text-[10px] font-medium">
                            {sale.commissionPct}% com. · {formatCurrency((sale.total * sale.commissionPct) / 100)}
                          </span>
                        )}
                      </p>
                    )}
                    {sale.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{sale.notes}</p>}
                    {(() => {
                      const returned = sale.returnedItems;
                      if (!returned || returned.length === 0) return null;
                      const totalSoldQty = sale.items.reduce((s, it) => s + it.quantity, 0);
                      const totalRetQty = returned.reduce((s, it) => s + it.quantity, 0);
                      const isTotal = totalRetQty >= totalSoldQty;
                      return (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded mt-1 ${isTotal ? "bg-destructive/10 text-destructive" : "bg-amber-100 text-amber-700"}`}>
                          <RotateCcw className="w-2.5 h-2.5" />
                          {isTotal ? "Devolvido total" : "Devolvido parcial"}
                          {sale.returnTotal ? ` · -${formatCurrency(sale.returnTotal)}` : ""}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-bold text-primary">{formatCurrency(sale.total)}</p>
                    <div className="flex items-center gap-0.5 justify-end mt-1">
                      <button
                        onClick={() => setReceiptSale(sale)}
                        className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Gerar recibo"
                      >
                        <Printer className="w-3.5 h-3.5 text-blue-500" />
                      </button>
                      <button
                        onClick={() => setReturnSale(sale)}
                        className="p-1.5 hover:bg-primary/10 rounded-lg transition-colors"
                        title="Registrar devolução"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button
                        onClick={async () => {
                          if (await askConfirm({ title: "Cancelar venda", description: "Cancelar esta venda e restaurar o estoque? Esta ação não pode ser desfeita.", confirmText: "Cancelar venda", variant: "destructive" })) {
                            deleteMutation.mutate(sale.id);
                          }
                        }}
                        className="p-1.5 hover:bg-destructive/10 rounded-lg transition-colors"
                        title="Cancelar venda"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <Dialog open={newSaleOpen} onOpenChange={(o) => { if (!o) setNewSaleOpen(false); }}>
        {newSaleOpen && <SaleDialog onClose={() => setNewSaleOpen(false)} />}
      </Dialog>
      {returnSale && <ReturnDialog sale={returnSale} onClose={() => setReturnSale(null)} />}
      {receiptSale && <PrintReceiptModal sale={receiptSale} onClose={() => setReceiptSale(null)} />}
    </div>
  );
}
