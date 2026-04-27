import { useState, useRef, useEffect } from "react";
import { useConfirm } from "@/hooks/use-confirm";
import {
  useListInventory, useCreateInventoryItem, useUpdateInventoryItem, useDeleteInventoryItem,
  getListInventoryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus, AlertTriangle, Pencil, Trash2, Package,
  Plus as PlusIcon, Minus, Calculator, TrendingUp, Tag, ShoppingBag, ArrowRight,
  Mic, MicOff, CheckCircle2, X, Search, Truck, Building2, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";

// ─── Interpretação do texto de voz ───
function interpretarVoz(texto: string): { name: string; quantity: number; price: number; costPrice: number; minQuantity: number } {
  const t = texto.toLowerCase();

  const precoVendaMatch = t.match(/(?:venda|vendo|vendendo|vender|preco|pre[cç]o de venda)\s*(?:a|de|por|:)?\s*(\d+(?:[.,]\d+)?)/);
  const precoCustoMatch = t.match(/(?:custo|custou|paguei|comprei por|custa|custo de)\s*(?:a|de|por|:)?\s*(\d+(?:[.,]\d+)?)/);
  const qtdMatch       = t.match(/(?:estoque|quantidade|qtd|tenho|comprei)\s*(?:de|:)?\s*(\d+)/);
  const reaisMatch     = t.match(/(\d+(?:[.,]\d+)?)\s*reais/g);

  const parseNum = (s: string) => parseFloat(s.replace(",", ".")) || 0;

  let price    = precoVendaMatch ? parseNum(precoVendaMatch[1]) : 0;
  let costPrice = precoCustoMatch ? parseNum(precoCustoMatch[1]) : 0;
  let quantity  = qtdMatch ? parseInt(qtdMatch[1]) : 1;

  // fallback: pegar valores em reais na ordem custo → venda
  if (!price && !costPrice && reaisMatch && reaisMatch.length >= 1) {
    const vals = reaisMatch.map((s) => parseNum(s.replace(" reais", "")));
    if (vals.length === 1) price = vals[0];
    if (vals.length >= 2) { costPrice = vals[0]; price = vals[1]; }
  }

  // remover números e palavras-chave para obter o nome limpo
  let name = t
    .replace(/(?:venda|vendo|vendendo|vender|preco|pre[cç]o de venda)\s*(?:a|de|por|:)?\s*\d+(?:[.,]\d+)?/g, "")
    .replace(/(?:custo|custou|paguei|comprei por|custa|custo de)\s*(?:a|de|por|:)?\s*\d+(?:[.,]\d+)?/g, "")
    .replace(/(?:estoque|quantidade|qtd|tenho|comprei)\s*(?:de|:)?\s*\d+/g, "")
    .replace(/\d+(?:[.,]\d+)?\s*reais/g, "")
    .replace(/[,\.]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  // capitalizar primeira letra
  name = name.charAt(0).toUpperCase() + name.slice(1);

  return { name: name || "Produto", quantity, price, costPrice, minQuantity: 5 };
}

// ─── Componente de Voz ───
function VoiceCapture({ onResult }: { onResult: (data: ReturnType<typeof interpretarVoz>) => void }) {
  const [status, setStatus] = useState<"idle" | "listening" | "processing" | "unsupported">("idle");
  const [transcript, setTranscript] = useState("");
  const recRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) { setStatus("unsupported"); return; }
    const rec = new SpeechRec();
    rec.lang = "pt-BR";
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onresult = (e: SpeechRecognitionEvent) => {
      const text = e.results[0][0].transcript;
      setTranscript(text);
      setStatus("processing");
      setTimeout(() => {
        onResult(interpretarVoz(text));
        setStatus("idle");
        setTranscript("");
      }, 600);
    };

    rec.onerror = () => setStatus("idle");
    rec.onend   = () => { if (status === "listening") setStatus("idle"); };
    recRef.current = rec;
  }, []);

  const toggle = () => {
    if (status === "listening") {
      recRef.current?.stop();
      setStatus("idle");
    } else {
      recRef.current?.start();
      setStatus("listening");
      setTranscript("");
    }
  };

  if (status === "unsupported") return null;

  return (
    <div className="relative">
      <button
        onClick={toggle}
        title="Adicionar por voz"
        className={`
          relative flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all active:scale-95
          ${status === "listening"
            ? "bg-primary text-white border-primary shadow-lg shadow-primary/30 animate-pulse"
            : status === "processing"
            ? "bg-primary/20 text-primary border-primary/40"
            : "bg-card text-muted-foreground hover:text-foreground hover:border-primary/40"}
        `}
      >
        {status === "listening" ? (
          <><MicOff className="w-4 h-4" /><span className="hidden sm:inline">Parar</span></>
        ) : status === "processing" ? (
          <><Mic className="w-4 h-4 text-primary" /><span className="hidden sm:inline">Processando…</span></>
        ) : (
          <><Mic className="w-4 h-4" /><span className="hidden sm:inline">Voz</span></>
        )}
      </button>

      {/* Transcript bubble */}
      {transcript && (
        <div className="absolute top-full mt-2 right-0 bg-sidebar text-sidebar-foreground text-xs px-3 py-2 rounded-lg shadow-lg max-w-[220px] z-50 border border-sidebar-border">
          "{transcript}"
        </div>
      )}

      {/* Listening pulse ring */}
      {status === "listening" && (
        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary animate-ping" />
      )}
    </div>
  );
}

// ─── Dialog de confirmação de voz ───
function VoiceConfirmDialog({
  data,
  onConfirm,
  onCancel,
}: {
  data: ReturnType<typeof interpretarVoz>;
  onConfirm: (d: ReturnType<typeof interpretarVoz>) => void;
  onCancel: () => void;
}) {
  const [local, setLocal] = useState({ ...data });
  const profit    = local.price - local.costPrice;
  const margin    = local.price > 0 ? (profit / local.price) * 100 : 0;

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="w-5 h-5 text-primary" /> Confirmar Produto por Voz
          </DialogTitle>
            <DialogDescription>Revise e ajuste os dados antes de salvar.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Nome</label>
            <Input value={local.name} onChange={(e) => setLocal({ ...local, name: e.target.value })} className="mt-1" placeholder="Nome do produto" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Quantidade</label>
              <Input type="number" min="0" value={local.quantity} className="mt-1"
                onChange={(e) => setLocal({ ...local, quantity: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Tag className="w-3 h-3 text-destructive" />Custo
              </label>
              <Input type="number" step="0.01" min="0" value={local.costPrice} className="mt-1"
                onChange={(e) => setLocal({ ...local, costPrice: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <ShoppingBag className="w-3 h-3 text-primary" />Venda
              </label>
              <Input type="number" step="0.01" min="0" value={local.price} className="mt-1"
                onChange={(e) => setLocal({ ...local, price: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>

          {/* Preview lucro */}
          {(local.costPrice > 0 || local.price > 0) && (
            <div className="bg-muted/40 rounded-lg px-3 py-2 border flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Lucro estimado</span>
              <div className="text-right">
                <span className={`font-bold ${profit >= 0 ? "text-primary" : "text-destructive"}`}>
                  {formatCurrency(profit)}
                </span>
                <span className="text-xs text-muted-foreground ml-1">({margin.toFixed(0)}%)</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 mt-2">
          <Button variant="outline" onClick={onCancel} className="flex-1 sm:flex-none">
            <X className="w-4 h-4 mr-1" />Cancelar
          </Button>
          <Button onClick={() => onConfirm(local)} disabled={!local.name.trim()} className="flex-1 sm:flex-none">
            <CheckCircle2 className="w-4 h-4 mr-1" />Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Fornecedores ───
type Supplier = { id: number; name: string; contactName: string | null; phone: string | null; email: string | null; notes: string | null };

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";
async function apiFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, { credentials: "include", ...init });
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Erro"); }
  return res.json();
}

const SUPPLIER_KEYS = ["suppliers"];

function useSuppliers() {
  return useQuery<Supplier[]>({ queryKey: SUPPLIER_KEYS, queryFn: () => apiFetch(`${BASE}/suppliers`) });
}

function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: Omit<Supplier, "id">) => apiFetch(`${BASE}/suppliers`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: SUPPLIER_KEYS }) });
}

function useUpdateSupplier() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...data }: Supplier) => apiFetch(`${BASE}/suppliers/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: SUPPLIER_KEYS }) });
}

function useDeleteSupplier() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: number) => apiFetch(`${BASE}/suppliers/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: SUPPLIER_KEYS }) });
}

// ─── Dialog Fornecedor ───
function SupplierDialog({
  supplier, onClose,
}: { supplier?: Supplier | null; onClose: () => void }) {
  const isEdit = !!supplier;
  const create = useCreateSupplier();
  const update = useUpdateSupplier();
  const [form, setForm] = useState({
    name: supplier?.name ?? "",
    contactName: supplier?.contactName ?? "",
    phone: supplier?.phone ?? "",
    email: supplier?.email ?? "",
    notes: supplier?.notes ?? "",
  });
  const [err, setErr] = useState<string | null>(null);
  const isPending = create.isPending || update.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setErr("Nome obrigatório"); return; }
    const payload = { name: form.name.trim(), contactName: form.contactName.trim() || null, phone: form.phone.trim() || null, email: form.email.trim() || null, notes: form.notes.trim() || null };
    if (isEdit && supplier) {
      update.mutate({ id: supplier.id, ...payload }, { onSuccess: onClose, onError: (e: any) => setErr(e.message) });
    } else {
      create.mutate(payload as any, { onSuccess: onClose, onError: (e: any) => setErr(e.message) });
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-primary" />{isEdit ? "Editar Fornecedor" : "Novo Fornecedor"}
          </DialogTitle>
          <DialogDescription>Dados de contato do fornecedor.</DialogDescription>
        </DialogHeader>
        {err && <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{err}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Nome *</label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Distribuidora ABC" className="mt-1" autoFocus />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Contato</label>
            <Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} placeholder="Nome do responsável" className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Telefone</label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-9999" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">E-mail</label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="contato@email.com" className="mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Observações</label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Ex: prazo 30 dias" className="mt-1" />
          </div>
          <DialogFooter className="gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 sm:flex-none">Cancelar</Button>
            <Button type="submit" disabled={isPending} className="flex-1 sm:flex-none">
              {isPending ? "Salvando..." : isEdit ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const itemSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  supplier: z.string().optional(),
  quantity: z.number().int().min(0),
  minQuantity: z.number().int().min(0).default(5),
  costPrice: z.number().min(0).default(0),
  price: z.number().min(0).default(0),
  priceAPrazo: z.number().min(0).default(0),
});

type ItemForm = z.infer<typeof itemSchema>;

type Item = {
  id: number; name: string; supplier: string | null; quantity: number; minQuantity: number;
  costPrice: number; price: number; priceAPrazo: number; profitPerUnit: number;
  marginPct: number; markupPct: number; totalStockValue: number;
  totalSaleValue: number; isLowStock: boolean; createdAt: string;
};

// ─── Barra de margem ───
function MarginBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const color = pct >= 40 ? "bg-primary" : pct >= 20 ? "bg-amber-400" : pct >= 0 ? "bg-orange-400" : "bg-destructive";
  const label = pct >= 40 ? "text-primary" : pct >= 20 ? "text-amber-600" : pct >= 0 ? "text-orange-500" : "text-destructive";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className={`text-[10px] font-bold w-8 text-right shrink-0 ${label}`}>{pct.toFixed(0)}%</span>
    </div>
  );
}

// ─── Calculadora de Vendas ───
function SalesCalculator({ item, onClose }: { item: Item; onClose: () => void }) {
  const [qty, setQty] = useState(1);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<"pct" | "value">("pct");

  const grossRevenue = item.price * qty;
  const discountValue = discountType === "pct" ? grossRevenue * (discount / 100) : Math.min(discount, grossRevenue);
  const netRevenue = grossRevenue - discountValue;
  const totalCost = item.costPrice * qty;
  const grossProfit = netRevenue - totalCost;
  const netMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;
  const effectiveSalePrice = qty > 0 ? netRevenue / qty : 0;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Calculator className="w-4 h-4 text-primary shrink-0" />
            <span className="truncate">{item.name}</span>
          </DialogTitle>
          <DialogDescription>Simule margem de lucro e ponto de equilíbrio do produto.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Quantidade */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Quantidade a vender</label>
            <div className="flex items-center gap-2">
              <button onClick={() => setQty(Math.max(1, qty - 1))}
                className="w-10 h-10 border rounded-lg flex items-center justify-center hover:bg-muted active:scale-90 transition-all shrink-0">
                <Minus className="w-4 h-4" />
              </button>
              <Input type="number" min="1" value={qty}
                onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="text-center font-bold text-lg h-10" />
              <button onClick={() => setQty(qty + 1)}
                className="w-10 h-10 border rounded-lg flex items-center justify-center hover:bg-primary/10 active:scale-90 transition-all shrink-0">
                <PlusIcon className="w-4 h-4" />
              </button>
            </div>
            {qty > item.quantity && (
              <p className="text-xs text-amber-600 mt-1">⚠ Estoque: {item.quantity} unidades</p>
            )}
          </div>

          {/* Desconto */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Desconto</label>
            <div className="flex gap-2">
              <div className="flex border rounded-lg overflow-hidden shrink-0">
                <button onClick={() => setDiscountType("pct")}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${discountType === "pct" ? "bg-primary text-white" : "hover:bg-muted"}`}>%</button>
                <button onClick={() => setDiscountType("value")}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${discountType === "value" ? "bg-primary text-white" : "hover:bg-muted"}`}>R$</button>
              </div>
              <Input type="number" min="0" step="0.01" value={discount}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                placeholder={discountType === "pct" ? "0" : "0,00"} />
            </div>
          </div>

          {/* Resultado */}
          <div className="bg-muted/40 rounded-xl p-3 space-y-2 border">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              <span className="text-muted-foreground">Preco unit.</span>
              <span className="font-medium text-right">{formatCurrency(item.price)}</span>

              {discountValue > 0 && (
                <>
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium text-right">{formatCurrency(grossRevenue)}</span>
                  <span className="text-muted-foreground">Desconto</span>
                  <span className="text-destructive font-medium text-right">-{formatCurrency(discountValue)}</span>
                  <span className="text-muted-foreground">Unit. c/ desc.</span>
                  <span className="font-medium text-right">{formatCurrency(effectiveSalePrice)}</span>
                </>
              )}
            </div>
            <div className="border-t pt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
              <span className="text-sm font-semibold">Total liquido</span>
              <span className="font-bold text-primary text-right">{formatCurrency(netRevenue)}</span>
              <span className="text-sm text-muted-foreground">Custo total</span>
              <span className="text-destructive font-medium text-right">{formatCurrency(totalCost)}</span>
              <span className="text-sm font-semibold">Lucro</span>
              <span className={`font-bold text-right ${grossProfit >= 0 ? "text-primary" : "text-destructive"}`}>
                {formatCurrency(grossProfit)}
              </span>
              <span className="text-sm text-muted-foreground">Margem</span>
              <span className={`font-semibold text-right ${netMargin >= 0 ? "text-primary" : "text-destructive"}`}>
                {netMargin.toFixed(1)}%
              </span>
            </div>
            <MarginBar pct={netMargin} />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="w-full">Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Inventory() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [calcItem, setCalcItem] = useState<Item | null>(null);
  const [voiceData, setVoiceData] = useState<ReturnType<typeof interpretarVoz> | null>(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"produtos" | "fornecedores">("produtos");
  const [supplierDialog, setSupplierDialog] = useState<{ open: boolean; supplier?: Supplier | null }>({ open: false });
  const [deleteSupplierConfirm, setDeleteSupplierConfirm] = useState<number | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();
  const { confirm: askConfirm, ConfirmDialog } = useConfirm();

  const { data: suppliers = [] } = useSuppliers();
  const deleteSupplier = useDeleteSupplier();

  const { data: items = [], isLoading } = useListInventory();
  const createItem = useCreateInventoryItem();
  const updateItem = useUpdateInventoryItem();
  const deleteItem = useDeleteInventoryItem();

  const form = useForm<ItemForm>({
    resolver: zodResolver(itemSchema),
    defaultValues: { name: "", supplier: "", quantity: 0, minQuantity: 5, costPrice: 0, price: 0, priceAPrazo: 0 },
  });

  const openCreate = () => {
    setEditItem(null);
    form.reset({ name: "", supplier: "", quantity: 0, minQuantity: 5, costPrice: 0, price: 0, priceAPrazo: 0 });
    setDialogOpen(true);
  };

  const openEdit = (item: Item) => {
    setEditItem(item);
    form.reset({ name: item.name, supplier: item.supplier ?? "", quantity: item.quantity, minQuantity: item.minQuantity, costPrice: item.costPrice, price: item.price, priceAPrazo: item.priceAPrazo ?? 0 });
    setDialogOpen(true);
  };

  const onSubmit = (data: ItemForm) => {
    const payload = { data: { name: data.name, supplier: data.supplier?.trim() || null, quantity: data.quantity, minQuantity: data.minQuantity, costPrice: data.costPrice, price: data.price, priceAPrazo: data.priceAPrazo } };
    if (editItem) {
      updateItem.mutate({ id: editItem.id, ...payload }, {
        onSuccess: () => { qc.invalidateQueries({ queryKey: getListInventoryQueryKey() }); setDialogOpen(false); toast({ title: "Item atualizado" }); },
      });
    } else {
      createItem.mutate(payload, {
        onSuccess: () => { qc.invalidateQueries({ queryKey: getListInventoryQueryKey() }); setDialogOpen(false); toast({ title: "Item cadastrado" }); },
      });
    }
  };

  const adjustQty = (item: Item, delta: number) => {
    const newQty = Math.max(0, item.quantity + delta);
    updateItem.mutate({ id: item.id, data: { quantity: newQty } }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListInventoryQueryKey() }),
    });
  };

  const handleDelete = async (id: number, name: string) => {
    if (!await askConfirm({ title: "Excluir item", description: `Tem certeza que deseja excluir "${name}"? Esta ação não pode ser desfeita.`, confirmText: "Excluir", variant: "destructive" })) return;
    deleteItem.mutate({ id }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListInventoryQueryKey() }); toast({ title: "Item removido" }); },
    });
  };

  const handleVoiceConfirm = (data: ReturnType<typeof interpretarVoz>) => {
    createItem.mutate(
      { data: { name: data.name, quantity: data.quantity, minQuantity: data.minQuantity, costPrice: data.costPrice, price: data.price } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListInventoryQueryKey() });
          setVoiceData(null);
          toast({ title: `"${data.name}" adicionado por voz!` });
        },
      }
    );
  };

  const typedItems = (items as any[]).map((i) => ({
    ...i,
    supplier: i.supplier ?? null,
    costPrice: Number(i.costPrice ?? 0),
    price: Number(i.price ?? 0),
    priceAPrazo: Number(i.priceAPrazo ?? 0),
    profitPerUnit: Number(i.profitPerUnit ?? 0),
    marginPct: Number(i.marginPct ?? 0),
    markupPct: Number(i.markupPct ?? 0),
    totalStockValue: Number(i.totalStockValue ?? 0),
    totalSaleValue: Number(i.totalSaleValue ?? 0),
    isLowStock: Boolean(i.isLowStock),
  })) as Item[];

  const sq = search.toLowerCase();
  const filteredItems = sq
    ? typedItems.filter((i) => i.name.toLowerCase().includes(sq) || (i.supplier ?? "").toLowerCase().includes(sq))
    : typedItems;
  const lowStockCount = typedItems.filter((i) => i.isLowStock).length;
  const totalCostValue = typedItems.reduce((s, i) => s + i.totalStockValue, 0);
  const totalSaleValue = typedItems.reduce((s, i) => s + i.totalSaleValue, 0);
  const totalProfit = totalSaleValue - totalCostValue;
  const avgMargin = totalSaleValue > 0 ? (totalProfit / totalSaleValue) * 100 : 0;

  const costPrice = form.watch("costPrice") ?? 0;
  const salePrice = form.watch("price") ?? 0;
  const profitPreview = salePrice - costPrice;
  const marginPreview = salePrice > 0 ? (profitPreview / salePrice) * 100 : 0;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto animate-fade-in">
      {ConfirmDialog}
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Estoque</h1>
          <p className="text-muted-foreground text-sm">
            {typedItems.length} produtos
            {lowStockCount > 0 && <span className="text-red-600 font-medium"> · {lowStockCount} em baixa</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {activeTab === "produtos" ? (
            <>
              <VoiceCapture onResult={setVoiceData} />
              <Button onClick={openCreate} size="sm">
                <Plus className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">Novo Produto</span>
                <span className="sm:hidden">Novo</span>
              </Button>
            </>
          ) : (
            <Button onClick={() => setSupplierDialog({ open: true, supplier: null })} size="sm">
              <Plus className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Novo Fornecedor</span>
              <span className="sm:hidden">Novo</span>
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-muted/40 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("produtos")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === "produtos" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Package className="w-3.5 h-3.5" /> Produtos
        </button>
        <button
          onClick={() => setActiveTab("fornecedores")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === "fornecedores" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Truck className="w-3.5 h-3.5" /> Fornecedores
          {suppliers.length > 0 && (
            <span className="text-[10px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded-full">{suppliers.length}</span>
          )}
        </button>
      </div>

      {/* ─── ABA FORNECEDORES ─── */}
      {activeTab === "fornecedores" && (
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          {suppliers.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <Truck className="w-10 h-10 mx-auto mb-3 opacity-25" />
              <p className="text-sm">Nenhum fornecedor cadastrado</p>
              <Button onClick={() => setSupplierDialog({ open: true })} variant="outline" size="sm" className="mt-3">
                <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar fornecedor
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {suppliers.map((s) => (
                <div key={s.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{s.name}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      {s.contactName && <span className="text-[11px] text-muted-foreground">👤 {s.contactName}</span>}
                      {s.phone && <span className="text-[11px] text-muted-foreground">📞 {s.phone}</span>}
                      {s.email && <span className="text-[11px] text-muted-foreground">✉ {s.email}</span>}
                      {s.notes && <span className="text-[11px] text-muted-foreground italic">{s.notes}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setSupplierDialog({ open: true, supplier: s })} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted transition-colors">
                      <Pencil className="w-3 h-3 text-muted-foreground" />
                    </button>
                    {deleteSupplierConfirm === s.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => { deleteSupplier.mutate(s.id); setDeleteSupplierConfirm(null); }} className="px-2 py-1 text-xs bg-destructive text-white rounded-lg">Confirmar</button>
                        <button onClick={() => setDeleteSupplierConfirm(null)} className="px-2 py-1 text-xs border rounded-lg text-muted-foreground">Cancelar</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteSupplierConfirm(s.id)} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-destructive/10 transition-colors">
                        <Trash2 className="w-3 h-3 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── ABA PRODUTOS ─── */}
      {activeTab === "produtos" && <>

      {/* Cards de resumo — 2 colunas no mobile, 4 no desktop */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4">
        <div className="bg-card border rounded-xl p-3 shadow-sm">
          <div className="flex items-center gap-1 mb-1">
            <Tag className="w-3 h-3 text-muted-foreground shrink-0" />
            <p className="text-[10px] text-muted-foreground font-medium leading-tight">Custo Estoque</p>
          </div>
          <p className="text-sm md:text-base font-bold leading-tight">{formatCurrency(totalCostValue)}</p>
        </div>
        <div className="bg-card border rounded-xl p-3 shadow-sm">
          <div className="flex items-center gap-1 mb-1">
            <ShoppingBag className="w-3 h-3 text-primary shrink-0" />
            <p className="text-[10px] text-muted-foreground font-medium leading-tight">Valor Venda</p>
          </div>
          <p className="text-sm md:text-base font-bold text-primary leading-tight">{formatCurrency(totalSaleValue)}</p>
        </div>
        <div className="bg-card border rounded-xl p-3 shadow-sm">
          <div className="flex items-center gap-1 mb-1">
            <TrendingUp className="w-3 h-3 text-primary shrink-0" />
            <p className="text-[10px] text-muted-foreground font-medium leading-tight">Lucro Total</p>
          </div>
          <p className={`text-sm md:text-base font-bold leading-tight ${totalProfit >= 0 ? "text-primary" : "text-destructive"}`}>
            {formatCurrency(totalProfit)}
          </p>
        </div>
        <div className={`border rounded-xl p-3 shadow-sm ${avgMargin >= 20 ? "bg-primary/5 border-primary/20" : "bg-amber-50 border-amber-200"}`}>
          <div className="flex items-center gap-1 mb-1">
            <Calculator className={`w-3 h-3 shrink-0 ${avgMargin >= 20 ? "text-primary" : "text-amber-600"}`} />
            <p className="text-[10px] text-muted-foreground font-medium leading-tight">Margem Media</p>
          </div>
          <p className={`text-sm md:text-base font-bold leading-tight ${avgMargin >= 20 ? "text-primary" : "text-amber-600"}`}>
            {avgMargin.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Alerta estoque baixo */}
      {lowStockCount > 0 && (
        <div className="mb-3 flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-500 mt-0.5" />
          <span><strong>{lowStockCount} produto{lowStockCount !== 1 ? "s" : ""}</strong> com estoque abaixo do mínimo — reabastecer urgente!</span>
        </div>
      )}

      {/* Busca */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou fornecedor..."
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

      {/* Lista de produtos */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-25" />
            <p className="text-sm">{search ? `Nenhum produto encontrado para "${search}"` : "Nenhum produto cadastrado"}</p>
            {!search && (
              <Button onClick={openCreate} variant="outline" size="sm" className="mt-3">
                <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar produto
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y">
            {filteredItems.map((item) => (
              <div key={item.id}
                className={`px-3 py-3 transition-colors ${item.isLowStock ? "bg-red-50/70" : "hover:bg-muted/15"}`}>

                {/* Linha 1: nome + badge + controles de quantidade + ações */}
                <div className="flex items-center gap-2 mb-2">
                  {/* Ícone */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.isLowStock ? "bg-red-100" : "bg-muted"}`}>
                    <Package className={`w-3.5 h-3.5 ${item.isLowStock ? "text-red-600" : "text-muted-foreground"}`} />
                  </div>

                  {/* Nome */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold break-words">{item.name}</span>
                      {item.isLowStock && (
                        <span className="text-[9px] bg-red-100 text-red-700 px-1 py-0.5 rounded font-bold tracking-wide shrink-0">⚠ BAIXO</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] text-muted-foreground">Min: {item.minQuantity} un</span>
                      {item.supplier && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                          · <span className="font-medium">{item.supplier}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quantidade + ações (tudo na mesma linha) */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => adjustQty(item, -1)}
                      className="w-7 h-7 flex items-center justify-center border rounded-md bg-card hover:bg-muted active:scale-90 transition-all">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className={`w-7 text-center text-sm font-bold ${item.isLowStock ? "text-red-600" : ""}`}>
                      {item.quantity}
                    </span>
                    <button onClick={() => adjustQty(item, 1)}
                      className="w-7 h-7 flex items-center justify-center border rounded-md bg-card hover:bg-primary/10 active:scale-90 transition-all">
                      <PlusIcon className="w-3 h-3" />
                    </button>
                    <div className="w-px h-5 bg-border mx-0.5" />
                    <button onClick={() => setCalcItem(item)}
                      className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-primary/10 active:scale-95 transition-all" title="Calculadora">
                      <Calculator className="w-3.5 h-3.5 text-primary" />
                    </button>
                    <button onClick={() => openEdit(item)}
                      className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted active:scale-95 transition-all">
                      <Pencil className="w-3 h-3 text-muted-foreground" />
                    </button>
                    <button onClick={() => handleDelete(item.id, item.name)}
                      className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-destructive/10 active:scale-95 transition-all">
                      <Trash2 className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </div>
                </div>

                {/* Linha 2: custo → venda, lucro, markup — tudo compacto numa linha */}
                <div className="ml-10 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <div className="flex items-center gap-1 bg-muted/60 rounded px-1.5 py-0.5">
                      <Tag className="w-2.5 h-2.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Custo</span>
                      <span className="font-semibold">{formatCurrency(item.costPrice)}</span>
                    </div>
                    <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                    <div className="flex items-center gap-1 bg-primary/8 rounded px-1.5 py-0.5">
                      <ShoppingBag className="w-2.5 h-2.5 text-primary" />
                      <span className="text-muted-foreground">Venda</span>
                      <span className="font-semibold text-primary">{formatCurrency(item.price)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Lucro/un</span>
                      <span className={`font-bold ${item.profitPerUnit >= 0 ? "text-primary" : "text-destructive"}`}>
                        {formatCurrency(item.profitPerUnit)}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5 text-muted-foreground">
                      <span>Mkp</span>
                      <span className="font-medium">{item.markupPct.toFixed(0)}%</span>
                    </div>
                  </div>

                  {/* Barra de margem */}
                  {item.price > 0 && <MarginBar pct={item.marginPct} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialog cadastro/edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md mx-4">
          <DialogHeader>
            <DialogTitle>{editItem ? "Editar Produto" : "Novo Produto"}</DialogTitle>
            <DialogDescription>Preencha as informações do produto para o estoque.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Nome</FormLabel><FormControl>
                  <Input {...field} placeholder="Ex: Parafuso M6" />
                </FormControl><FormMessage /></FormItem>
              )} />

              <FormField control={form.control} name="supplier" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center justify-between">
                    <span>Fornecedor <span className="text-muted-foreground font-normal text-xs">(opcional)</span></span>
                    <button type="button" onClick={() => setSupplierDialog({ open: true, supplier: null })} className="text-[11px] text-primary hover:underline flex items-center gap-0.5">
                      <Plus className="w-3 h-3" /> Novo fornecedor
                    </button>
                  </FormLabel>
                  <FormControl>
                    <select
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value || undefined)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <option value="">— Nenhum —</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-2">
                <FormField control={form.control} name="quantity" render={({ field }) => (
                  <FormItem><FormLabel>Qtd</FormLabel><FormControl>
                    <Input type="number" min="0" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} />
                  </FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="minQuantity" render={({ field }) => (
                  <FormItem><FormLabel>Qtd Min</FormLabel><FormControl>
                    <Input type="number" min="0" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} />
                  </FormControl><FormMessage /></FormItem>
                )} />
              </div>

              {/* Precificação */}
              <div className="border rounded-xl p-3 space-y-3 bg-muted/20">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Precificacao</p>
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="costPrice" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1 text-xs">
                        <Tag className="w-3 h-3 text-destructive" /> Custo (R$)
                      </FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} />
                      </FormControl><FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="price" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1 text-xs">
                        <ShoppingBag className="w-3 h-3 text-primary" /> À Vista (R$)
                      </FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} />
                      </FormControl><FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="priceAPrazo" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1 text-xs">
                      <Tag className="w-3 h-3 text-amber-600" /> A Prazo (R$)
                      <span className="text-muted-foreground font-normal">(opcional)</span>
                    </FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        placeholder="0,00 = mesmo que à vista" />
                    </FormControl><FormMessage />
                  </FormItem>
                )} />

                {/* Preview ao vivo */}
                {(costPrice > 0 || salePrice > 0) && (
                  <div className="bg-card rounded-lg px-3 py-2 border text-xs grid grid-cols-3 gap-2">
                    <div className="text-center">
                      <p className="text-muted-foreground">Lucro/un</p>
                      <p className={`font-bold mt-0.5 ${profitPreview >= 0 ? "text-primary" : "text-destructive"}`}>
                        {formatCurrency(profitPreview)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground">Margem</p>
                      <p className={`font-bold mt-0.5 ${marginPreview >= 20 ? "text-primary" : marginPreview >= 0 ? "text-amber-600" : "text-destructive"}`}>
                        {marginPreview.toFixed(1)}%
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground">Markup</p>
                      <p className="font-bold mt-0.5">
                        {costPrice > 0 ? ((profitPreview / costPrice) * 100).toFixed(0) : "—"}%
                      </p>
                    </div>
                    <div className="col-span-3 mt-1">
                      <MarginBar pct={marginPreview} />
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1 sm:flex-none">Cancelar</Button>
                <Button type="submit" disabled={createItem.isPending || updateItem.isPending} className="flex-1 sm:flex-none">
                  {editItem ? "Salvar" : "Cadastrar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {calcItem && <SalesCalculator item={calcItem} onClose={() => setCalcItem(null)} />}

      {voiceData && (
        <VoiceConfirmDialog
          data={voiceData}
          onConfirm={handleVoiceConfirm}
          onCancel={() => setVoiceData(null)}
        />
      )}
      </>}{/* end aba produtos */}

      {supplierDialog.open && (
        <SupplierDialog
          supplier={supplierDialog.supplier}
          onClose={() => setSupplierDialog({ open: false })}
        />
      )}
    </div>
  );
}
