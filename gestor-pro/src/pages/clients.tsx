import { useState, useCallback } from "react";
import { useConfirm } from "@/hooks/use-confirm";
import { Link } from "wouter";
import {
  useListClients, useCreateClient, useUpdateClient, useDeleteClient,
  getListClientsQueryKey, getGetAlertsQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus, Search, Phone, Mail, AlertTriangle, ChevronRight,
  Pencil, Trash2, MessageCircle, Users, Calendar, CreditCard,
  Banknote, Receipt, TrendingDown, CheckCircle2, History,
  FileText, ShoppingBag, ClipboardList, ArrowUpCircle, TrendingUp,
  MapPin, Loader2, Briefcase, User, Building2, Clock, Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { VoiceButton } from "@/components/VoiceButton";
import { formatCurrency, formatDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { useCompanySettings } from "@/hooks/use-company-settings";

const clientSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  fantasia: z.string().optional().default(""),
  personType: z.enum(["PF", "PJ"]).default("PF"),
  cnpj: z.string().optional().default(""),
  phone: z.string().min(1, "Telefone obrigatório"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  notes: z.string().optional(),
  isDebtor: z.boolean().default(false),
  debtAmount: z.number().min(0).default(0),
  debtDueDate: z.string().optional(),
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
});

const paymentSchema = z.object({
  amount: z.number({ required_error: "Informe o valor" }).positive("Valor inválido"),
  paymentMethod: z.enum(["pix", "cartao_credito", "cartao_debito", "dinheiro", "boleto", "crediario"], {
    required_error: "Selecione a forma de pagamento",
  }),
  installments: z.number().int().min(1).max(48).default(1),
  notes: z.string().optional(),
});

type ClientForm = z.infer<typeof clientSchema>;
type PaymentForm = z.infer<typeof paymentSchema>;
type Client = {
  id: number; name: string; fantasia?: string | null; phone: string; email?: string | null;
  personType: string; cnpj?: string | null;
  notes?: string | null; isDebtor: boolean;
  debtAmount: number; debtPaidAmount: number;
  debtDueDate?: string | null;
  whatsappUrl: string; createdAt: string;
  cep?: string | null; logradouro?: string | null; numero?: string | null;
  complemento?: string | null; bairro?: string | null;
  cidade?: string | null; estado?: string | null;
};

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

const PAYMENT_METHODS: { value: PaymentForm["paymentMethod"]; label: string; icon: React.ElementType }[] = [
  { value: "pix",           label: "PIX",            icon: Banknote },
  { value: "cartao_credito",label: "Crédito",         icon: CreditCard },
  { value: "cartao_debito", label: "Débito",          icon: CreditCard },
  { value: "dinheiro",      label: "Dinheiro",        icon: Banknote },
  { value: "boleto",        label: "Boleto",          icon: Receipt },
  { value: "crediario",     label: "Crediário",       icon: TrendingDown },
];

function interpretarCliente(texto: string): Partial<ClientForm> {
  const t = texto.toLowerCase();
  const phoneMatch = t.match(/(?:telefone|fone|whatsapp|celular|numero)\s*[:=]?\s*([\d\s\(\)\-]+)/);
  const emailMatch = t.match(/(?:email|e-mail)\s*[:=]?\s*([\w.\-]+@[\w.\-]+\.\w+)/i);
  let phone = phoneMatch ? phoneMatch[1].replace(/\D/g, "") : "";
  let email = emailMatch ? emailMatch[1] : "";
  let name = texto
    .replace(/(?:telefone|fone|whatsapp|celular|numero)\s*[:=]?\s*[\d\s\(\)\-]+/gi, "")
    .replace(/(?:email|e-mail)\s*[:=]?\s*[\w.\-]+@[\w.\-]+\.\w+/gi, "")
    .replace(/[,\.]/g, " ").replace(/\s{2,}/g, " ").trim();
  name = name ? name.charAt(0).toUpperCase() + name.slice(1) : "";
  return { name, phone, email };
}

function DebtProgress({ paid, total }: { paid: number; total: number }) {
  if (total <= 0) return null;
  const pct = Math.min(100, (paid / total) * 100);
  return (
    <div className="mt-1.5 w-full">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] text-muted-foreground">
          Pago {formatCurrency(paid)} de {formatCurrency(total)}
        </span>
        <span className="text-[10px] font-semibold text-primary">{pct.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function PaymentDialog({ client, onClose }: { client: Client; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const remaining = client.debtAmount - (client.debtPaidAmount ?? 0);

  const form = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: remaining > 0 ? remaining : 0, paymentMethod: "pix", installments: 1, notes: "" },
  });

  const paymentMethod = form.watch("paymentMethod");
  const showInstallments = paymentMethod === "cartao_credito" || paymentMethod === "crediario";

  const { data: history = [], isLoading: histLoading } = useQuery({
    queryKey: ["debt-payments", client.id],
    queryFn: () => fetch(`/api/clients/${client.id}/debt-payments`).then((r) => r.json()),
  });

  const mutation = useMutation({
    mutationFn: (data: PaymentForm) =>
      fetch(`/api/clients/${client.id}/debt-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) { const e = await r.json(); throw new Error(e.error || "Erro ao registrar pagamento"); }
        return r.json();
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: getListClientsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetAlertsQueryKey() });
      qc.invalidateQueries({ queryKey: ["debt-payments", client.id] });
      if (res.fullyPaid) {
        toast({ title: "✅ Dívida quitada!", description: `${client.name} não é mais devedor.` });
        onClose();
      } else {
        toast({ title: "Pagamento registrado", description: `${formatCurrency(form.getValues("amount"))} via ${PAYMENT_METHODS.find(m => m.value === form.getValues("paymentMethod"))?.label}` });
        form.reset({ amount: remaining - form.getValues("amount"), paymentMethod: "pix", installments: 1, notes: "" });
      }
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const methodLabel: Record<string, string> = {
    pix: "PIX", cartao_credito: "Crédito", cartao_debito: "Débito",
    dinheiro: "Dinheiro", boleto: "Boleto", crediario: "Crediário",
  };

  return (
    <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-primary" />
          Dar Baixa — {client.name}
        </DialogTitle>
        <DialogDescription>Registre um pagamento parcial ou total da dívida do cliente.</DialogDescription>
      </DialogHeader>

      {/* Debt summary */}
      <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-3 mb-1">
        <div className="grid grid-cols-3 gap-2 text-center mb-2">
          <div>
            <p className="text-[11px] text-muted-foreground">Total</p>
            <p className="text-sm font-bold text-destructive">{formatCurrency(client.debtAmount)}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Já pago</p>
            <p className="text-sm font-bold text-primary">{formatCurrency(client.debtPaidAmount ?? 0)}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Restante</p>
            <p className="text-sm font-bold">{formatCurrency(Math.max(0, remaining))}</p>
          </div>
        </div>
        <DebtProgress paid={client.debtPaidAmount ?? 0} total={client.debtAmount} />
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <FormField control={form.control} name="amount" render={({ field }) => (
            <FormItem>
              <FormLabel>Valor Recebido (R$)</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" min="0.01" max={remaining}
                  {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  placeholder="0,00" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="paymentMethod" render={({ field }) => (
            <FormItem>
              <FormLabel>Forma de Pagamento</FormLabel>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map((m) => {
                  const Icon = m.icon;
                  return (
                    <button key={m.value} type="button"
                      onClick={() => { field.onChange(m.value); if (m.value !== "cartao_credito" && m.value !== "crediario") form.setValue("installments", 1); }}
                      className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                        field.value === m.value
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "bg-card text-muted-foreground border hover:border-primary/40 hover:text-foreground"
                      }`}>
                      <Icon className="w-4 h-4" />
                      {m.label}
                    </button>
                  );
                })}
              </div>
              <FormMessage />
            </FormItem>
          )} />

          {showInstallments && (
            <FormField control={form.control} name="installments" render={({ field }) => (
              <FormItem>
                <FormLabel>Número de Parcelas</FormLabel>
                <div className="flex gap-1.5 flex-wrap">
                  {[1, 2, 3, 4, 5, 6, 9, 10, 12].map((n) => (
                    <button key={n} type="button"
                      onClick={() => field.onChange(n)}
                      className={`w-9 h-9 rounded-lg text-sm font-semibold border transition-all ${
                        field.value === n ? "bg-primary text-white border-primary" : "bg-card text-muted-foreground border hover:border-primary/40"
                      }`}>
                      {n}x
                    </button>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )} />
          )}

          <FormField control={form.control} name="notes" render={({ field }) => (
            <FormItem>
              <FormLabel>Observações (opcional)</FormLabel>
              <FormControl><Textarea {...field} placeholder="Ex: Parcela 1/3, depósito na conta..." rows={2} /></FormControl>
            </FormItem>
          )} />

          <DialogFooter className="gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 sm:flex-none">Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending} className="flex-1 sm:flex-none">
              {mutation.isPending ? "Registrando..." : "Registrar Pagamento"}
            </Button>
          </DialogFooter>
        </form>
      </Form>

      {/* Payment history */}
      {(history as any[]).length > 0 && (
        <div className="mt-1 border-t pt-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Histórico de Pagamentos</p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {(history as any[]).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between text-sm bg-muted/30 rounded-lg px-3 py-2">
                <div>
                  <span className="font-medium text-primary">{formatCurrency(p.amount)}</span>
                  <span className="text-muted-foreground text-xs ml-2">{methodLabel[p.paymentMethod] || p.paymentMethod}</span>
                  {p.installments > 1 && <span className="text-muted-foreground text-xs ml-1">· {p.installments}x</span>}
                  {p.notes && <p className="text-xs text-muted-foreground mt-0.5">{p.notes}</p>}
                </div>
                <span className="text-xs text-muted-foreground shrink-0 ml-2">
                  {new Date(p.paidAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </DialogContent>
  );
}

// ─── HistoryDialog ────────────────────────────────────────────────
function HistoryDialog({ client, onClose }: { client: Client; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["client-history", client.id],
    queryFn: () => fetch(`/api/clients/${client.id}/history`).then((r) => r.json()),
  });

  const quoteStatusLabel: Record<string, { label: string; color: string }> = {
    pending:   { label: "Pendente",   color: "text-amber-600 bg-amber-50 border-amber-200" },
    converted: { label: "Convertido", color: "text-primary bg-primary/5 border-primary/20" },
    rejected:  { label: "Recusado",   color: "text-destructive bg-destructive/5 border-destructive/20" },
  };
  const payMethodLabel: Record<string, string> = {
    pix: "PIX", cartao_credito: "Crédito", cartao_debito: "Débito",
    dinheiro: "Dinheiro", boleto: "Boleto", crediario: "Crediário",
  };

  type TimelineItem = {
    id: string; date: string; icon: React.ElementType;
    iconColor: string; title: string; subtitle?: string;
    amount?: number; amountColor?: string; badge?: string; badgeColor?: string;
  };

  const items: TimelineItem[] = [];

  if (data) {
    (data.quotes ?? []).forEach((q: any) => {
      const s = quoteStatusLabel[q.status] ?? quoteStatusLabel.pending;
      items.push({
        id: `q-${q.id}`, date: q.createdAt,
        icon: FileText, iconColor: "text-blue-500 bg-blue-50",
        title: q.title || q.description || "Orçamento",
        subtitle: q.description,
        amount: q.amount, amountColor: "text-blue-600",
        badge: s.label, badgeColor: s.color,
      });
    });
    (data.transactions ?? []).filter((t: any) => t.type === "income").forEach((t: any) => {
      items.push({
        id: `t-${t.id}`, date: t.createdAt,
        icon: ShoppingBag, iconColor: "text-primary bg-primary/10",
        title: t.description,
        amount: t.amount, amountColor: "text-primary",
      });
    });
    (data.debtPayments ?? []).forEach((p: any) => {
      items.push({
        id: `dp-${p.id}`, date: p.paidAt,
        icon: ArrowUpCircle, iconColor: "text-emerald-600 bg-emerald-50",
        title: "Pagamento de dívida",
        subtitle: `${payMethodLabel[p.paymentMethod] ?? p.paymentMethod}${p.installments > 1 ? ` (${p.installments}x)` : ""}${p.notes ? ` · ${p.notes}` : ""}`,
        amount: p.amount, amountColor: "text-emerald-600",
      });
    });
    (data.tasks ?? []).forEach((t: any) => {
      items.push({
        id: `tk-${t.id}`, date: t.createdAt,
        icon: ClipboardList, iconColor: "text-violet-500 bg-violet-50",
        title: t.title,
        subtitle: t.dueDate ? `Prazo: ${formatDate(t.dueDate)}` : undefined,
        badge: t.status === "done" ? "Concluído" : t.isOverdue ? "Atrasado" : "Pendente",
        badgeColor: t.status === "done" ? "text-primary bg-primary/5 border-primary/20" : t.isOverdue ? "text-destructive bg-destructive/5 border-destructive/20" : "text-amber-600 bg-amber-50 border-amber-200",
      });
    });
  }

  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalSpent = (data?.transactions ?? [])
    .filter((t: any) => t.type === "income")
    .reduce((s: number, t: any) => s + t.amount, 0)
  + (data?.debtPayments ?? []).reduce((s: number, p: any) => s + p.amount, 0);
  const openQuotes = (data?.quotes ?? []).filter((q: any) => q.status === "pending").length;

  return (
    <DialogContent className="max-w-lg mx-auto max-h-[90vh] flex flex-col">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${client.isDebtor ? "bg-destructive/15 text-destructive" : "bg-primary/10 text-primary"}`}>
            {client.name.charAt(0).toUpperCase()}
          </div>
          Histórico — {client.name}
        </DialogTitle>
        <DialogDescription>Vendas, orçamentos, pagamentos e tarefas relacionados a este cliente.</DialogDescription>
      </DialogHeader>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center py-10">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-primary/5 border border-primary/15 rounded-xl p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Total pago</p>
              <p className="text-sm font-bold text-primary">{formatCurrency(totalSpent)}</p>
            </div>
            <div className="bg-muted/50 border rounded-xl p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Orçamentos</p>
              <p className="text-sm font-bold">{(data?.quotes ?? []).length}</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-center">
              <p className="text-[10px] text-amber-700 uppercase tracking-wide mb-0.5">Em aberto</p>
              <p className="text-sm font-bold text-amber-700">{openQuotes}</p>
            </div>
          </div>

          {/* Timeline */}
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {items.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-25" />
                <p className="text-sm">Nenhuma movimentação ainda</p>
              </div>
            ) : items.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-xl border">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${item.iconColor}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-snug truncate">{item.title}</p>
                      {item.amount !== undefined && (
                        <p className={`text-sm font-bold shrink-0 ${item.amountColor}`}>
                          {formatCurrency(item.amount)}
                        </p>
                      )}
                    </div>
                    {item.subtitle && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{item.subtitle}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(item.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                      {item.badge && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${item.badgeColor}`}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </DialogContent>
  );
}

export default function Clients() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paymentClient, setPaymentClient] = useState<Client | null>(null);
  const [historyClient, setHistoryClient] = useState<Client | null>(null);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [filterDebtors, setFilterDebtors] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: company } = useCompanySettings();
  const { confirm: askConfirm, ConfirmDialog } = useConfirm();

  const { data: clients = [], isLoading } = useListClients();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();

  const [cepLoading, setCepLoading] = useState(false);

  const emptyAddress = { cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "" };

  const form = useForm<ClientForm>({
    resolver: zodResolver(clientSchema),
    defaultValues: { name: "", fantasia: "", personType: "PF", cnpj: "", phone: "", email: "", notes: "", isDebtor: false, debtAmount: 0, ...emptyAddress },
  });

  const lookupCep = useCallback(async (cep: string) => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        form.setValue("logradouro", data.logradouro ?? "");
        form.setValue("bairro", data.bairro ?? "");
        form.setValue("cidade", data.localidade ?? "");
        form.setValue("estado", data.uf ?? "");
      }
    } catch {}
    setCepLoading(false);
  }, [form]);

  const openCreate = (prefill?: Partial<ClientForm>) => {
    setEditClient(null);
    form.reset({ name: "", fantasia: "", personType: "PF", cnpj: "", phone: "", email: "", notes: "", isDebtor: false, debtAmount: 0, ...emptyAddress, ...prefill });
    setDialogOpen(true);
  };

  const openEdit = (c: Client) => {
    setEditClient(c);
    form.reset({
      name: c.name, fantasia: c.fantasia ?? "", personType: (c.personType as "PF" | "PJ") ?? "PF", cnpj: c.cnpj ?? "",
      phone: c.phone, email: c.email ?? "", notes: c.notes ?? "",
      isDebtor: c.isDebtor, debtAmount: c.debtAmount, debtDueDate: c.debtDueDate ?? "",
      cep: c.cep ?? "", logradouro: c.logradouro ?? "", numero: c.numero ?? "",
      complemento: c.complemento ?? "", bairro: c.bairro ?? "",
      cidade: c.cidade ?? "", estado: c.estado ?? "",
    });
    setDialogOpen(true);
  };

  const onSubmit = (data: ClientForm) => {
    const payload = {
      data: {
        name: data.name, fantasia: data.fantasia || null, personType: data.personType, cnpj: data.cnpj || "",
        phone: data.phone, email: data.email || undefined,
        notes: data.notes, isDebtor: data.isDebtor, debtAmount: data.debtAmount,
        debtDueDate: data.debtDueDate || null,
        cep: data.cep || null, logradouro: data.logradouro || null,
        numero: data.numero || null, complemento: data.complemento || null,
        bairro: data.bairro || null, cidade: data.cidade || null, estado: data.estado || null,
      }
    };
    if (editClient) {
      updateClient.mutate({ id: editClient.id, ...payload }, {
        onSuccess: () => { qc.invalidateQueries({ queryKey: getListClientsQueryKey() }); qc.invalidateQueries({ queryKey: getGetAlertsQueryKey() }); setDialogOpen(false); toast({ title: "Cliente atualizado" }); },
      });
    } else {
      createClient.mutate(payload, {
        onSuccess: () => { qc.invalidateQueries({ queryKey: getListClientsQueryKey() }); qc.invalidateQueries({ queryKey: getGetAlertsQueryKey() }); setDialogOpen(false); toast({ title: "Cliente cadastrado" }); },
      });
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!await askConfirm({ title: "Excluir cliente", description: `Tem certeza que deseja excluir "${name}"? Esta ação não pode ser desfeita.`, confirmText: "Excluir", variant: "destructive" })) return;
    deleteClient.mutate({ id }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListClientsQueryKey() }); toast({ title: "Cliente removido" }); } });
  };

  const isDebtor = form.watch("isDebtor");
  const personType = form.watch("personType");
  const typedClients = clients as Client[];
  const filtered = typedClients.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search) || (c.email ?? "").toLowerCase().includes(search.toLowerCase());
    return matchSearch && (!filterDebtors || c.isDebtor);
  });
  const debtorCount = typedClients.filter((c) => c.isDebtor).length;
  const totalDebt = typedClients.filter((c) => c.isDebtor).reduce((s, c) => s + (c.debtAmount - (c.debtPaidAmount ?? 0)), 0);

  const getDebtWhatsappUrl = (client: typeof typedClients[number]) => {
    const phone = client.phone.replace(/\D/g, "");
    if (!phone) return "#";
    const remaining = client.debtAmount - (client.debtPaidAmount ?? 0);
    const nomeEmpresa = company?.name ?? "nossa empresa";
    const fmtVal = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const fmtDue = (d?: string | null) =>
      d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : null;
    const dueStr = fmtDue(client.debtDueDate);
    const msg = [
      `Olá ${client.name}, tudo bem? 😊`,
      ``,
      `Passando para avisar que você possui um débito pendente de *${fmtVal(remaining > 0 ? remaining : client.debtAmount)}* com *${nomeEmpresa}*.`,
      dueStr ? `📅 Vencimento: *${dueStr}*` : null,
      ``,
      `Por favor, entre em contato para regularizar. Estamos à disposição! 🙏`,
      ``,
      `_Enviado via GestorX7_`,
    ].filter((l) => l !== null).join("\n");
    return `https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`;
  };

  const handlePrintDebtors = () => {
    const debtors = typedClients.filter((c) => c.isDebtor).sort((a, b) => {
      const aDate = a.debtDueDate ?? "";
      const bDate = b.debtDueDate ?? "";
      return aDate.localeCompare(bDate);
    });
    const now = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    const totalRestante = debtors.reduce((s, c) => s + (c.debtAmount - (c.debtPaidAmount ?? 0)), 0);
    const totalOriginal = debtors.reduce((s, c) => s + c.debtAmount, 0);
    const totalPago = debtors.reduce((s, c) => s + (c.debtPaidAmount ?? 0), 0);

    const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const fmtDate = (d?: string | null) => {
      if (!d) return "—";
      const [y, m, day] = d.split("-");
      return `${day}/${m}/${y}`;
    };
    const isOverdue = (d?: string | null) => {
      if (!d) return false;
      return d < new Date().toISOString().split("T")[0];
    };

    const rows = debtors.map((c, i) => {
      const remaining = c.debtAmount - (c.debtPaidAmount ?? 0);
      const pct = c.debtAmount > 0 ? Math.round(((c.debtPaidAmount ?? 0) / c.debtAmount) * 100) : 0;
      const overdue = isOverdue(c.debtDueDate);
      return `
        <tr style="background:${i % 2 === 0 ? "#fff" : "#f9fafb"}">
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-weight:600">${c.name}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280">${c.phone || "—"}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right">${fmt(c.debtAmount)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#16a34a">${fmt(c.debtPaidAmount ?? 0)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;color:#dc2626">${fmt(remaining)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center">
            <span style="background:#e5e7eb;border-radius:4px;padding:1px 6px;font-size:12px;color:#374151">${pct}% pago</span>
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;color:${overdue ? "#dc2626" : "#374151"};font-weight:${overdue ? "700" : "400"}">
            ${fmtDate(c.debtDueDate)}${overdue ? " ⚠" : ""}
          </td>
        </tr>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Devedores — GestorX7</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#111;background:#f0f0f0;min-height:100vh;padding:24px 16px 48px}
    .toolbar{position:sticky;top:0;z-index:100;background:#fff;border-bottom:1px solid #e5e7eb;padding:12px 24px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 2px 8px rgba(0,0,0,.08)}
    .toolbar-title{font-size:15px;font-weight:700;color:#111}
    .toolbar-sub{font-size:12px;color:#888;margin-top:1px}
    .btn-print{display:flex;align-items:center;gap:8px;background:#1AAF54;color:#fff;border:none;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer}
    .btn-print:hover{background:#158f44}
    .page{background:#fff;max-width:900px;margin:24px auto 0;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.10);padding:36px 44px}
    .co-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1AAF54;padding-bottom:14px;margin-bottom:24px}
    .co-name{font-size:20px;font-weight:800;color:#1AAF54}
    .summary{display:flex;gap:16px;margin-bottom:20px;flex-wrap:wrap}
    .summary-card{background:#f3f4f6;border-radius:8px;padding:10px 16px;flex:1;min-width:140px}
    .summary-card .label{font-size:11px;color:#6b7280;margin-bottom:2px}
    .summary-card .value{font-size:16px;font-weight:700}
    .summary-card.red .value{color:#dc2626}
    .summary-card.green .value{color:#16a34a}
    table{width:100%;border-collapse:collapse;font-size:12px}
    thead tr{background:#1AAF54;color:#fff}
    thead th{padding:9px 11px;text-align:left;font-weight:600}
    thead th.right{text-align:right} thead th.center{text-align:center}
    tfoot td{padding:9px 11px;font-weight:700;border-top:2px solid #1AAF54;background:#f9fafb}
    tbody td{padding:9px 11px;border-bottom:1px solid #e5e7eb}
    .footer-doc{margin-top:28px;font-size:11px;color:#bbb;text-align:right}
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
      <div class="toolbar-title">Relatório de Devedores — GestorX7</div>
      <div class="toolbar-sub">Confira a lista abaixo e clique em Imprimir para salvar como PDF</div>
    </div>
    <button class="btn-print" onclick="window.print()">🖨 Imprimir / Gerar PDF</button>
  </div>

  <div class="page">
    <div class="co-header">
      <div>
        <div class="co-name">GestorX7</div>
        <div style="font-size:12px;color:#888;margin-top:2px">Relatório de Devedores</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:12px;color:#888">Gerado em ${now}</div>
        <div style="font-size:12px;color:#888">${debtors.length} cliente${debtors.length !== 1 ? "s" : ""} devedor${debtors.length !== 1 ? "es" : ""}</div>
      </div>
    </div>

    <div class="summary">
      <div class="summary-card">
        <div class="label">Total Original</div>
        <div class="value">${fmt(totalOriginal)}</div>
      </div>
      <div class="summary-card green">
        <div class="label">Total Pago</div>
        <div class="value">${fmt(totalPago)}</div>
      </div>
      <div class="summary-card red">
        <div class="label">Total a Receber</div>
        <div class="value">${fmt(totalRestante)}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Nome</th>
          <th>Telefone</th>
          <th class="right">Dívida Total</th>
          <th class="right">Pago</th>
          <th class="right">Restante</th>
          <th class="center">Progresso</th>
          <th class="center">Vencimento</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <td colspan="2">Total (${debtors.length} devedor${debtors.length !== 1 ? "es" : ""})</td>
          <td style="text-align:right">${fmt(totalOriginal)}</td>
          <td style="text-align:right;color:#16a34a">${fmt(totalPago)}</td>
          <td style="text-align:right;color:#dc2626">${fmt(totalRestante)}</td>
          <td colspan="2"></td>
        </tr>
      </tfoot>
    </table>
    <div class="footer-doc">GestorX7 — Emitido em ${now}</div>
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
      {ConfirmDialog}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Clientes</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {typedClients.length} cadastrados
            {debtorCount > 0 && <span className="text-destructive font-medium ml-1">· {debtorCount} devedores ({formatCurrency(totalDebt)} restante)</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <VoiceButton onTranscript={(t) => openCreate(interpretarCliente(t))} />
          <Button onClick={() => openCreate()} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Novo Cliente</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar nome, telefone, email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <button
          onClick={() => setFilterDebtors(!filterDebtors)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all shrink-0 ${filterDebtors ? "bg-destructive text-white border-destructive" : "bg-card text-muted-foreground hover:text-foreground"}`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Devedores</span>
        </button>
        {debtorCount > 0 && (
          <button
            onClick={handlePrintDebtors}
            title="Imprimir lista de devedores"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all shrink-0 bg-card text-muted-foreground hover:text-foreground hover:border-primary/50"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Imprimir</span>
          </button>
        )}
      </div>

      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-25" />
            <p className="text-sm">{search || filterDebtors ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado ainda"}</p>
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((client) => {
              const paid = client.debtPaidAmount ?? 0;
              const remaining = client.debtAmount - paid;
              const today = new Date().toISOString().split("T")[0];
              return (
                <div key={client.id} className="px-4 py-3.5 hover:bg-muted/25 active:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${client.isDebtor ? "bg-destructive/15 text-destructive" : "bg-primary/10 text-primary"}`}>
                      {client.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-medium text-sm">{client.name}</p>
                        {client.personType === "PJ" && (
                          <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded-full font-bold shrink-0 flex items-center gap-0.5">
                            <Building2 className="w-2.5 h-2.5" />PJ
                          </span>
                        )}
                        {client.isDebtor && (
                          <span className="text-[11px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full font-semibold shrink-0">
                            deve {formatCurrency(remaining > 0 ? remaining : client.debtAmount)}
                          </span>
                        )}
                        {client.isDebtor && client.debtDueDate && (() => {
                          const isOverdue = client.debtDueDate! < today;
                          const isToday = client.debtDueDate === today;
                          return (
                            <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5 shrink-0 ${
                              isOverdue ? "bg-destructive text-white animate-pulse" :
                              isToday   ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground"
                            }`}>
                              <Calendar className="w-2.5 h-2.5" />
                              {isOverdue ? "ATRASADO" : isToday ? "Cobrar hoje" : formatDate(client.debtDueDate!)}
                            </span>
                          );
                        })()}
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 flex-wrap">
                        <Phone className="w-3 h-3" />{client.phone}
                        {client.email && <><span className="mx-1">·</span><Mail className="w-3 h-3" /><span className="truncate max-w-[100px]">{client.email}</span></>}
                        {client.personType === "PJ" && client.cnpj && (
                          <><span className="mx-1">·</span><Building2 className="w-3 h-3" /><span className="truncate max-w-[130px]">{client.cnpj}</span></>
                        )}
                        {(client.cidade || client.estado) && (
                          <><span className="mx-1">·</span><MapPin className="w-3 h-3" />
                          <span className="truncate max-w-[120px]">{[client.cidade, client.estado].filter(Boolean).join(" / ")}</span></>
                        )}
                        {client.createdAt && (
                          <><span className="mx-1">·</span><Clock className="w-3 h-3" />
                          <span>desde {new Date(client.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</span></>
                        )}
                      </p>
                      {/* Payment progress bar for debtors */}
                      {client.isDebtor && paid > 0 && (
                        <DebtProgress paid={paid} total={client.debtAmount} />
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* "Dar Baixa" button only for debtors */}
                      {client.isDebtor && (
                        <button
                          onClick={() => setPaymentClient(client)}
                          className="flex items-center gap-1 px-2 py-1.5 bg-primary text-white text-xs rounded-lg hover:bg-primary/90 active:scale-95 transition-all font-medium shrink-0"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Dar Baixa</span>
                        </button>
                      )}
                      <a
                        href={client.isDebtor ? getDebtWhatsappUrl(client) : client.whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={client.isDebtor ? "Enviar cobrança via WhatsApp" : "Abrir WhatsApp"}
                        className="flex items-center gap-1 px-2 py-1.5 bg-[#25D366] text-white text-xs rounded-lg hover:bg-[#1ebe59] active:scale-95 transition-all font-medium">
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{client.isDebtor ? "Cobrar" : "WhatsApp"}</span>
                      </a>
                      <button
                        onClick={() => setHistoryClient(client)}
                        className="p-2 hover:bg-muted rounded-lg transition-colors active:scale-95"
                        title="Ver histórico"
                      >
                        <History className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button onClick={() => openEdit(client)} className="p-2 hover:bg-muted rounded-lg transition-colors active:scale-95">
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button onClick={() => handleDelete(client.id, client.name)} className="p-2 hover:bg-destructive/10 rounded-lg transition-colors active:scale-95">
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <Link href={`/clientes/${client.id}`}>
                        <button className="p-2 hover:bg-muted rounded-lg transition-colors active:scale-95">
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Client create/edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editClient ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* ── Tipo de pessoa ── */}
              <FormField control={form.control} name="personType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de cliente</FormLabel>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => field.onChange("PF")}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${field.value === "PF" ? "border-primary bg-primary/5 text-primary" : "border-muted text-muted-foreground hover:border-primary/40"}`}
                    >
                      <User className="w-4 h-4" />
                      Pessoa Física (PF)
                    </button>
                    <button
                      type="button"
                      onClick={() => field.onChange("PJ")}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${field.value === "PJ" ? "border-primary bg-primary/5 text-primary" : "border-muted text-muted-foreground hover:border-primary/40"}`}
                    >
                      <Briefcase className="w-4 h-4" />
                      Pessoa Jurídica (PJ)
                    </button>
                  </div>
                </FormItem>
              )} />

              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>{personType === "PJ" ? "Razão Social / Nome da empresa" : "Nome"}</FormLabel><FormControl><Input {...field} placeholder={personType === "PJ" ? "Ex: Empresa Ltda" : "Nome do cliente"} /></FormControl><FormMessage /></FormItem>
              )} />

              {/* ── CNPJ e Nome Fantasia só aparecem se PJ ── */}
              {personType === "PJ" && (
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="cnpj" render={({ field }) => (
                    <FormItem>
                      <FormLabel>CNPJ</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="00.000.000/0001-00"
                          value={field.value}
                          onChange={(e) => field.onChange(formatCnpj(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="fantasia" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Fantasia <span className="text-muted-foreground font-normal">(opcional)</span></FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Nome pelo qual é conhecido" />
                      </FormControl>
                    </FormItem>
                  )} />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>Telefone / WhatsApp</FormLabel><FormControl><Input {...field} placeholder="(00) 00000-0000" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email (opcional)</FormLabel><FormControl><Input {...field} type="email" placeholder="email@exemplo.com" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Observações</FormLabel><FormControl><Textarea {...field} placeholder="Anotações sobre o cliente..." rows={2} /></FormControl><FormMessage /></FormItem>
              )} />

              {/* Address section */}
              <div className="border rounded-lg p-3 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Endereço (opcional)
                </p>
                <FormField control={form.control} name="cep" render={({ field }) => (
                  <FormItem>
                    <FormLabel>CEP</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          placeholder="00000-000"
                          maxLength={9}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, "").replace(/^(\d{5})(\d)/, "$1-$2");
                            field.onChange(v);
                            lookupCep(v);
                          }}
                        />
                        {cepLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="logradouro" render={({ field }) => (
                  <FormItem><FormLabel>Rua / Logradouro</FormLabel><FormControl><Input {...field} placeholder="Rua, Av., etc." /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="numero" render={({ field }) => (
                    <FormItem><FormLabel>Número</FormLabel><FormControl><Input {...field} placeholder="Ex: 123" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="complemento" render={({ field }) => (
                    <FormItem><FormLabel>Complemento</FormLabel><FormControl><Input {...field} placeholder="Apto, Bloco..." /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="bairro" render={({ field }) => (
                  <FormItem><FormLabel>Bairro</FormLabel><FormControl><Input {...field} placeholder="Bairro" /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="cidade" render={({ field }) => (
                    <FormItem><FormLabel>Cidade</FormLabel><FormControl><Input {...field} placeholder="Cidade" /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="estado" render={({ field }) => (
                    <FormItem><FormLabel>Estado (UF)</FormLabel><FormControl><Input {...field} placeholder="SP" maxLength={2} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </div>

              <FormField control={form.control} name="isDebtor" render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <FormLabel className="m-0">Marcar como Devedor</FormLabel>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />
              {isDebtor && (
                <div className="space-y-3 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                  <FormField control={form.control} name="debtAmount" render={({ field }) => (
                    <FormItem><FormLabel>Valor Total da Dívida (R$)</FormLabel><FormControl>
                      <Input type="number" step="0.01" min="0" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} />
                    </FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="debtDueDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />Data de Pagamento
                      </FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <p className="text-[11px] text-muted-foreground">Alerta automático na data de vencimento.</p>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              )}
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1 sm:flex-none">Cancelar</Button>
                <Button type="submit" disabled={createClient.isPending || updateClient.isPending} className="flex-1 sm:flex-none">
                  {editClient ? "Salvar" : "Cadastrar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Payment dialog */}
      <Dialog open={!!paymentClient} onOpenChange={(o) => { if (!o) setPaymentClient(null); }}>
        {paymentClient && (
          <PaymentDialog client={paymentClient} onClose={() => setPaymentClient(null)} />
        )}
      </Dialog>

      {/* History dialog */}
      <Dialog open={!!historyClient} onOpenChange={(o) => { if (!o) setHistoryClient(null); }}>
        {historyClient && (
          <HistoryDialog client={historyClient} onClose={() => setHistoryClient(null)} />
        )}
      </Dialog>
    </div>
  );
}
