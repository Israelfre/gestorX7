import { useState, useEffect } from "react";
import { useConfirm } from "@/hooks/use-confirm";
import {
  useListTransactions, useCreateTransaction, useDeleteTransaction, useGetFinancialSummary,
  getListTransactionsQueryKey, getGetFinancialSummaryQueryKey, getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, ChevronLeft, ChevronRight, Trash2, TrendingUp, TrendingDown, Wallet, DollarSign, Receipt, ChevronDown, ChevronUp, Settings2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { VoiceButton } from "@/components/VoiceButton";
import { formatCurrency, formatDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";

type Regime = "mei" | "simples" | "lucro_presumido";

const REGIME_LABELS: Record<Regime, string> = {
  mei: "MEI",
  simples: "Simples Nacional",
  lucro_presumido: "Lucro Presumido",
};

const REGIME_DEFAULT_RATES: Record<Regime, number> = {
  mei: 5,
  simples: 6,
  lucro_presumido: 11.33,
};

const REGIME_TRIBUTOS: Record<Regime, { nome: string; pct: number }[]> = {
  mei: [
    { nome: "DAS-MEI (fixo mensal)", pct: 0 },
  ],
  simples: [
    { nome: "DAS (Documento de Arrecadação do Simples)", pct: 6 },
  ],
  lucro_presumido: [
    { nome: "IRPJ", pct: 4.8 },
    { nome: "CSLL", pct: 2.88 },
    { nome: "PIS", pct: 0.65 },
    { nome: "COFINS", pct: 3 },
  ],
};

const LS_KEY = "gestorx_tax_config";

const VALID_REGIMES: Regime[] = ["mei", "simples", "lucro_presumido"];

function loadTaxConfig(): { regime: Regime; aliquota: number } {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        VALID_REGIMES.includes(parsed.regime) &&
        typeof parsed.aliquota === "number" &&
        isFinite(parsed.aliquota) &&
        parsed.aliquota >= 0 &&
        parsed.aliquota <= 100
      ) {
        return { regime: parsed.regime as Regime, aliquota: parsed.aliquota };
      }
    }
  } catch {}
  return { regime: "simples", aliquota: 6 };
}

function TaxPanel({ grossIncome }: { grossIncome: number }) {
  const saved = loadTaxConfig();
  const [regime, setRegime] = useState<Regime>(saved.regime);
  const [aliquota, setAliquota] = useState<number>(saved.aliquota);
  const [editingAliquota, setEditingAliquota] = useState<string>(String(saved.aliquota));
  const [expanded, setExpanded] = useState(true);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({ regime, aliquota }));
  }, [regime, aliquota]);

  const handleRegimeChange = (r: Regime) => {
    setRegime(r);
    const defaultRate = REGIME_DEFAULT_RATES[r];
    setAliquota(defaultRate);
    setEditingAliquota(String(defaultRate));
  };

  const handleAliquotaBlur = () => {
    const val = parseFloat(editingAliquota.replace(",", ".")) || 0;
    const clamped = Math.max(0, Math.min(100, val));
    setAliquota(clamped);
    setEditingAliquota(String(clamped));
  };

  const estimatedTax = grossIncome * (aliquota / 100);
  const netAfterTax = grossIncome - estimatedTax;
  const netMarginPct = grossIncome > 0 ? (netAfterTax / grossIncome) * 100 : 0;

  return (
    <div className="bg-card border rounded-xl shadow-sm overflow-hidden mb-4">
      <div className="w-full flex items-center gap-2 px-4 py-3 border-b bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
        role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setExpanded((v) => !v)}
      >
        <Receipt className="w-4 h-4 text-amber-500 shrink-0" />
        <h2 className="font-semibold text-sm">Tributos do Mês</h2>
        <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
          {REGIME_LABELS[regime]} · {aliquota}%
        </span>
        <div className="ml-auto flex items-center gap-1">
          <span
            role="button" tabIndex={0}
            onClick={(e) => { e.stopPropagation(); setShowConfig((v) => !v); setExpanded(true); }}
            onKeyDown={(e) => e.key === "Enter" && (e.stopPropagation(), setShowConfig((v) => !v), setExpanded(true))}
            className="p-1 rounded hover:bg-muted transition-colors"
            title="Configurar regime"
          >
            <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
          </span>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-4">
          {showConfig && (
            <div className="border rounded-lg p-3 bg-muted/20 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Configuração</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">Regime Tributário</label>
                  <Select value={regime} onValueChange={(v) => handleRegimeChange(v as Regime)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mei">MEI</SelectItem>
                      <SelectItem value="simples">Simples Nacional</SelectItem>
                      <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium block mb-1">Alíquota Efetiva (%)</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={editingAliquota}
                    onChange={(e) => setEditingAliquota(e.target.value)}
                    onBlur={handleAliquotaBlur}
                    className="text-sm h-8"
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                A alíquota padrão é uma referência. Informe a alíquota real do seu enquadramento.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-muted/30 rounded-lg p-3 border">
              <p className="text-[10px] text-muted-foreground font-medium mb-1">Receita Bruta</p>
              <p className="text-sm font-bold text-primary">{formatCurrency(grossIncome)}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 border">
              <p className="text-[10px] text-muted-foreground font-medium mb-1">Alíquota</p>
              <p className="text-sm font-bold text-amber-600">{aliquota.toFixed(2)}%</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-[10px] text-amber-700 font-medium mb-1">Imposto Estimado</p>
              <p className="text-sm font-bold text-amber-700">{formatCurrency(estimatedTax)}</p>
            </div>
            <div className={`rounded-lg p-3 border ${netAfterTax >= 0 ? "bg-primary/5 border-primary/20" : "bg-destructive/5 border-destructive/20"}`}>
              <p className="text-[10px] text-muted-foreground font-medium mb-1">Margem Líquida</p>
              <p className={`text-sm font-bold ${netAfterTax >= 0 ? "text-primary" : "text-destructive"}`}>
                {formatCurrency(netAfterTax)}
                <span className="text-[10px] font-normal ml-1 opacity-70">({netMarginPct.toFixed(1)}%)</span>
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              Tributos de referência — {REGIME_LABELS[regime]}
            </p>
            <div className="space-y-1.5">
              {regime === "mei" ? (
                <div className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-muted/30 border">
                  <span className="text-foreground">DAS-MEI (fixo mensal)</span>
                  <span className="text-amber-600 font-medium">Valor fixo*</span>
                </div>
              ) : (
                REGIME_TRIBUTOS[regime].map((t) => {
                  const val = grossIncome * (t.pct / 100);
                  return (
                    <div key={t.nome} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-muted/30 border">
                      <span className="text-foreground">{t.nome}</span>
                      <div className="text-right">
                        <span className="text-muted-foreground mr-2">{t.pct}%</span>
                        <span className="text-amber-600 font-medium">{formatCurrency(val)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {regime === "mei" && (
              <p className="text-[10px] text-muted-foreground mt-1.5">
                * O DAS-MEI é um valor fixo mensal definido pelo governo. Verifique o valor atual no Portal do Empreendedor.
              </p>
            )}
            {regime !== "mei" && (
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Percentuais de referência. O total pode diferir da alíquota efetiva configurada acima.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const txSchema = z.object({
  description: z.string().min(1, "Descrição obrigatória"),
  amount: z.number().positive("Valor deve ser positivo"),
  type: z.enum(["income", "expense"]),
  category: z.string().min(1, "Categoria obrigatória"),
  dueDate: z.string().optional(),
});

type TxForm = z.infer<typeof txSchema>;
type Tx = { id: number; description: string; amount: number; type: "income" | "expense"; category: string; dueDate?: string | null; createdAt: string; };

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const CATEGORIAS: Record<string, string> = {
  servico: "Servicos", serviço: "Servicos", serviços: "Servicos",
  produto: "Produtos", produtos: "Produtos",
  material: "Materiais", materiais: "Materiais",
  aluguel: "Aluguel",
  funcionario: "Funcionarios", funcionários: "Funcionarios", salario: "Funcionarios", salário: "Funcionarios",
  marketing: "Marketing", publicidade: "Marketing",
  imposto: "Impostos", impostos: "Impostos", taxa: "Impostos",
};

function interpretarLancamento(texto: string): Partial<TxForm> {
  const t = texto.toLowerCase();

  const isExpense = /(?:despesa|gasto|gastei|paguei|compra|pagamento|saída|saida)/.test(t);
  const type: "income" | "expense" = isExpense ? "expense" : "income";

  const amountMatch = t.match(/(\d+(?:[.,]\d+)?)\s*(?:reais|r\$)?/);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(",", ".")) : 0;

  let category = "Servicos";
  for (const [key, val] of Object.entries(CATEGORIAS)) {
    if (t.includes(key)) { category = val; break; }
  }

  let description = texto
    .replace(/(?:receita|despesa|gasto|gastei|paguei|compra|pagamento|saída|saida|recebi|receber)/gi, "")
    .replace(/(\d+(?:[.,]\d+)?)\s*(?:reais|r\$)/gi, "")
    .replace(/[,\.]/g, " ").replace(/\s{2,}/g, " ").trim();

  description = description ? description.charAt(0).toUpperCase() + description.slice(1) : "";

  return { type, amount: amount || undefined as any, description, category };
}

export default function Financial() {
  const { confirm: askConfirm, ConfirmDialog } = useConfirm();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [txFilter, setTxFilter] = useState<"all" | "income" | "expense">("all");
  const [txSearch, setTxSearch] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: txs = [], isLoading } = useListTransactions({ month, year });
  const { data: summary } = useGetFinancialSummary({ month, year });
  const createTx = useCreateTransaction();
  const deleteTx = useDeleteTransaction();

  const form = useForm<TxForm>({
    resolver: zodResolver(txSchema),
    defaultValues: { description: "", amount: 0, type: "income", category: "Servicos" },
  });

  const openCreate = (prefill?: Partial<TxForm>) => {
    form.reset({ description: "", amount: 0, type: "income", category: "Servicos", ...prefill });
    setDialogOpen(true);
  };

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const onSubmit = (data: TxForm) => {
    createTx.mutate({ data: { description: data.description, amount: data.amount, type: data.type, category: data.category, dueDate: data.dueDate || undefined } }, {
      onSuccess: () => {
        [getListTransactionsQueryKey(), getGetFinancialSummaryQueryKey(), getGetDashboardSummaryQueryKey()].forEach(k => qc.invalidateQueries({ queryKey: k }));
        setDialogOpen(false);
        form.reset({ description: "", amount: 0, type: "income", category: "Servicos" });
        toast({ title: "Lançamento adicionado" });
      },
    });
  };

  const handleDelete = async (id: number) => {
    if (!await askConfirm({ title: "Excluir lançamento", description: "Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.", confirmText: "Excluir", variant: "destructive" })) return;
    deleteTx.mutate({ id }, { onSuccess: () => {
      [getListTransactionsQueryKey(), getGetFinancialSummaryQueryKey(), getGetDashboardSummaryQueryKey()].forEach(k => qc.invalidateQueries({ queryKey: k }));
      toast({ title: "Lançamento removido" });
    }});
  };

  const typedTxs = txs as Tx[];
  const income = (summary as any)?.income ?? typedTxs.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expenses = (summary as any)?.expenses ?? typedTxs.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const balance = income - expenses;

  const tsq = txSearch.toLowerCase();
  const filteredTxs = typedTxs.filter((t) => {
    if (txFilter !== "all" && t.type !== txFilter) return false;
    if (!tsq) return true;
    return t.description.toLowerCase().includes(tsq) || (t.category ?? "").toLowerCase().includes(tsq);
  });

  // Despesas agrupadas por categoria
  const expensesByCategory = typedTxs
    .filter(t => t.type === "expense")
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] ?? 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);
  const expenseCatList = Object.entries(expensesByCategory)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto animate-fade-in">
      {ConfirmDialog}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Financeiro</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Controle de receitas e despesas</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <VoiceButton onTranscript={(t) => openCreate(interpretarLancamento(t))} />
          <Button onClick={() => openCreate()} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Novo Lançamento</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 bg-card border rounded-xl px-4 py-2.5 shadow-sm">
        <button onClick={prevMonth} className="p-1.5 hover:bg-muted rounded-lg transition-colors active:scale-90">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-sm font-semibold text-foreground">
          {MONTHS[month - 1]} {year}
        </span>
        <button onClick={nextMonth} className="p-1.5 hover:bg-muted rounded-lg transition-colors active:scale-90">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 md:gap-3 mb-5">
        <div className="bg-card border rounded-xl p-2.5 md:p-4 shadow-sm">
          <div className="flex items-center gap-1 mb-1.5">
            <TrendingUp className="w-3 h-3 md:w-3.5 md:h-3.5 text-primary shrink-0" />
            <p className="text-[10px] md:text-[11px] text-muted-foreground font-medium">Receitas</p>
          </div>
          <p className="text-sm md:text-lg font-bold text-primary leading-tight">{formatCurrency(income)}</p>
        </div>
        <div className="bg-card border rounded-xl p-2.5 md:p-4 shadow-sm">
          <div className="flex items-center gap-1 mb-1.5">
            <TrendingDown className="w-3 h-3 md:w-3.5 md:h-3.5 text-destructive shrink-0" />
            <p className="text-[10px] md:text-[11px] text-muted-foreground font-medium">Despesas</p>
          </div>
          <p className="text-sm md:text-lg font-bold text-destructive leading-tight">{formatCurrency(expenses)}</p>
        </div>
        <div className={`border rounded-xl p-2.5 md:p-4 shadow-sm ${balance >= 0 ? "bg-primary/5 border-primary/20" : "bg-destructive/5 border-destructive/20"}`}>
          <div className="flex items-center gap-1 mb-1.5">
            <Wallet className="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0 text-muted-foreground" />
            <p className="text-[10px] md:text-[11px] text-muted-foreground font-medium">Saldo</p>
          </div>
          <p className={`text-sm md:text-lg font-bold leading-tight ${balance >= 0 ? "text-primary" : "text-destructive"}`}>{formatCurrency(balance)}</p>
        </div>
      </div>

      <TaxPanel grossIncome={income} />

      {/* Despesas por categoria — aparece quando filtro = Despesas e há dados */}
      {txFilter === "expense" && expenseCatList.length > 0 && (
        <div className="bg-card border rounded-xl shadow-sm p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-4 h-4 text-destructive" />
            <h2 className="font-semibold text-sm">Despesas por Categoria</h2>
            <span className="ml-auto text-xs font-semibold text-destructive">{formatCurrency(expenses)}</span>
          </div>
          <div className="space-y-2.5">
            {expenseCatList.map(([cat, total]) => {
              const pct = expenses > 0 ? (total / expenses) * 100 : 0;
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-medium">{cat}</span>
                    <span className="text-xs text-destructive font-bold">{formatCurrency(total)}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-destructive/70 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{pct.toFixed(0)}% do total</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-2 flex-wrap">
          <DollarSign className="w-4 h-4 text-primary shrink-0" />
          <h2 className="font-semibold text-sm">Lançamentos de {MONTHS[month - 1]}</h2>
          <div className="ml-auto flex items-center gap-1">
            {(["all", "income", "expense"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setTxFilter(f)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                  txFilter === f
                    ? f === "expense" ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {f === "all" ? "Todos" : f === "income" ? "Receitas" : "Despesas"}
              </button>
            ))}
          </div>
        </div>
        <div className="px-4 py-2 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição ou categoria..."
              value={txSearch}
              onChange={(e) => setTxSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
            {txSearch && (
              <button onClick={() => setTxSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded">
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
        ) : filteredTxs.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">
              {txFilter === "expense" ? "Nenhuma despesa em " : txFilter === "income" ? "Nenhuma receita em " : "Nenhum lançamento em "}
              {MONTHS[month - 1]}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredTxs.map((tx) => (
              <div key={tx.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/20 active:bg-muted/30 transition-colors">
                <div className={`p-2 rounded-lg shrink-0 ${tx.type === "income" ? "bg-primary/10" : "bg-destructive/10"}`}>
                  {tx.type === "income" ? <TrendingUp className="w-4 h-4 text-primary" /> : <TrendingDown className="w-4 h-4 text-destructive" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{tx.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tx.category}
                    {tx.dueDate && <span> · Venc: {formatDate(tx.dueDate)}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <p className={`text-sm font-bold ${tx.type === "income" ? "text-primary" : "text-destructive"}`}>
                    {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}
                  </p>
                  <button onClick={() => handleDelete(tx.id)} className="p-1.5 hover:bg-destructive/10 rounded-lg transition-colors active:scale-95">
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo Lançamento</DialogTitle><DialogDescription>Registre uma receita ou despesa no financeiro.</DialogDescription></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem>
                  <div className="grid grid-cols-2 gap-2">
                    {(["income", "expense"] as const).map((t) => (
                      <button key={t} type="button" onClick={() => field.onChange(t)}
                        className={`py-2.5 text-sm rounded-lg border font-medium transition-all ${field.value === t ? (t === "income" ? "bg-primary text-white border-primary" : "bg-destructive text-white border-destructive") : "bg-card text-muted-foreground hover:text-foreground"}`}>
                        {t === "income" ? "Receita" : "Despesa"}
                      </button>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Descrição</FormLabel><FormControl><Input {...field} placeholder="Ex: Pagamento de serviço" /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="amount" render={({ field }) => (
                  <FormItem><FormLabel>Valor (R$)</FormLabel><FormControl>
                    <Input type="number" step="0.01" min="0" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} />
                  </FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="dueDate" render={({ field }) => (
                  <FormItem><FormLabel>Vencimento</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem><FormLabel>Categoria</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {["Servicos", "Produtos", "Materiais", "Aluguel", "Funcionarios", "Marketing", "Impostos", "Outros"].map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1 sm:flex-none">Cancelar</Button>
                <Button type="submit" disabled={createTx.isPending} className="flex-1 sm:flex-none">Adicionar</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
