import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Landmark, LockOpen, Lock, Clock, Wallet,
  AlertCircle, CheckCircle2, History, ChevronDown, ChevronUp,
  ArrowUpCircle, ArrowDownCircle, Plus, Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";

type Transaction = { id: number; type: string; amount: number; description: string; createdAt: string };
type Summary = { entradas: number; saidas: number; saldo: number };
type CurrentData = {
  open: boolean;
  session: { id: number; openedAt: string; openedByName: string; initialAmount: number } | null;
  summary?: Summary;
  recentTransactions?: Transaction[];
};
type HistoryItem = {
  id: number; status: string; openedAt: string; closedAt: string | null;
  openedByName: string; closedByName: string | null;
  initialAmount: number; finalAmount: number | null;
  totalEntradas: number | null; totalSaidas: number | null; diferenca: number | null;
  observations: string | null;
};

const SAIDA_SUGESTOES = ["Troco", "Vale funcionário", "Compra de material", "Despesa de entrega", "Sangria", "Reembolso"];
const ENTRADA_SUGESTOES = ["Troco devolvido", "Reforço de caixa", "Recebimento avulso", "Devolução de fornecedor"];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function elapsed(from: string) {
  const ms = Date.now() - new Date(from).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export default function Caixa() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [openDialog, setOpenDialog] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [movDialog, setMovDialog] = useState<"income" | "expense" | null>(null);

  const [initialAmount, setInitialAmount] = useState("");
  const [finalAmount, setFinalAmount] = useState("");
  const [openObs, setOpenObs] = useState("");
  const [closeObs, setCloseObs] = useState("");

  const [movDesc, setMovDesc] = useState("");
  const [movAmount, setMovAmount] = useState("");

  const [histExpanded, setHistExpanded] = useState(false);

  const { data: current, isLoading } = useQuery<CurrentData>({
    queryKey: ["caixa-current"],
    queryFn: async () => {
      const r = await fetch("/api/caixa/current");
      if (!r.ok) throw new Error("Erro ao buscar caixa");
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const { data: history = [] } = useQuery<HistoryItem[]>({
    queryKey: ["caixa-history"],
    queryFn: async () => {
      const r = await fetch("/api/caixa/history");
      if (!r.ok) throw new Error("Erro ao buscar histórico");
      return r.json();
    },
    enabled: histExpanded,
  });

  const openMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/caixa/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initialAmount: Number(initialAmount.replace(",", ".")) || 0, observations: openObs }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["caixa-current"] });
      qc.invalidateQueries({ queryKey: ["caixa-history"] });
      setOpenDialog(false); setInitialAmount(""); setOpenObs("");
      toast({ title: "Caixa aberto!", description: "Sessão de caixa iniciada com sucesso." });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const closeMutation = useMutation({
    mutationFn: async () => {
      const finalVal = finalAmount.replace(",", ".");
      const r = await fetch("/api/caixa/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finalAmount: finalVal ? Number(finalVal) : undefined, observations: closeObs }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
      return r.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["caixa-current"] });
      qc.invalidateQueries({ queryKey: ["caixa-history"] });
      setCloseDialog(false); setFinalAmount(""); setCloseObs("");
      const dif = data.summary?.diferenca ?? 0;
      const difText = dif === 0 ? "Sem diferença." : dif > 0 ? `Sobra de ${formatCurrency(dif)}.` : `Falta de ${formatCurrency(Math.abs(dif))}.`;
      toast({ title: "Caixa fechado!", description: difText });
      setHistExpanded(true);
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const movMutation = useMutation({
    mutationFn: async (type: "income" | "expense") => {
      const amount = Number(movAmount.replace(",", ".").replace(/[^\d.]/g, ""));
      if (!amount || amount <= 0) throw new Error("Informe um valor válido.");
      if (!movDesc.trim()) throw new Error("Informe uma descrição.");
      const r = await fetch("/api/financial/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, amount, description: movDesc.trim() }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Erro ao lançar."); }
      return r.json();
    },
    onSuccess: (_data, type) => {
      qc.invalidateQueries({ queryKey: ["caixa-current"] });
      setMovDialog(null); setMovDesc(""); setMovAmount("");
      toast({
        title: type === "expense" ? "Saída registrada!" : "Entrada registrada!",
        description: `${formatCurrency(Number(movAmount.replace(",", ".")))} lançado no caixa.`,
      });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const isOpen = current?.open;
  const session = current?.session;
  const summary = current?.summary;
  const recent = current?.recentTransactions ?? [];

  const sugestoes = movDialog === "expense" ? SAIDA_SUGESTOES : ENTRADA_SUGESTOES;

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Landmark className="w-6 h-6 text-primary" /> Caixa
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Controle de abertura e fechamento de caixa</p>
        </div>
        {!isLoading && (
          isOpen ? (
            <Button variant="destructive" size="sm" className="gap-2" onClick={() => { setFinalAmount(""); setCloseObs(""); setCloseDialog(true); }}>
              <Lock className="w-4 h-4" /> Fechar Caixa
            </Button>
          ) : (
            <Button size="sm" className="gap-2" onClick={() => { setInitialAmount(""); setOpenObs(""); setOpenDialog(true); }}>
              <LockOpen className="w-4 h-4" /> Abrir Caixa
            </Button>
          )
        )}
      </div>

      {/* Status Banner */}
      {isLoading ? (
        <Skeleton className="h-24 rounded-xl" />
      ) : isOpen && session ? (
        <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm text-primary">Caixa Aberto</p>
              <p className="text-xs text-muted-foreground">
                Por <span className="font-medium text-foreground">{session.openedByName}</span> às {fmtTime(session.openedAt)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>Aberto há {elapsed(session.openedAt)}</span>
          </div>
        </div>
      ) : (
        <div className="bg-muted/40 border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-sm">Caixa Fechado</p>
            <p className="text-xs text-muted-foreground">Nenhuma sessão ativa no momento.</p>
          </div>
        </div>
      )}

      {/* Quick action buttons — only when open */}
      {isOpen && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => { setMovDesc(""); setMovAmount(""); setMovDialog("expense"); }}
            className="flex items-center justify-center gap-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-500 font-semibold text-sm rounded-xl py-3.5 transition-colors active:scale-[0.98]"
          >
            <Minus className="w-4 h-4" />
            Lançar Saída
          </button>
          <button
            onClick={() => { setMovDesc(""); setMovAmount(""); setMovDialog("income"); }}
            className="flex items-center justify-center gap-2.5 bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary font-semibold text-sm rounded-xl py-3.5 transition-colors active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            Lançar Entrada
          </button>
        </div>
      )}

      {/* Summary cards (only when open) */}
      {isOpen && summary && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-card border rounded-xl p-3 shadow-sm">
              <p className="text-xs text-muted-foreground">Fundo Inicial</p>
              <p className="text-lg font-bold text-foreground mt-1">{formatCurrency(session!.initialAmount)}</p>
            </div>
            <div className="bg-card border rounded-xl p-3 shadow-sm">
              <p className="text-xs text-muted-foreground">Entradas</p>
              <p className="text-lg font-bold text-primary mt-1">{formatCurrency(summary.entradas)}</p>
            </div>
            <div className="bg-card border rounded-xl p-3 shadow-sm">
              <p className="text-xs text-muted-foreground">Saídas</p>
              <p className="text-lg font-bold text-destructive mt-1">{formatCurrency(summary.saidas)}</p>
            </div>
            <div className="bg-card border rounded-xl p-3 shadow-sm">
              <p className="text-xs text-muted-foreground">Saldo Esperado</p>
              <p className={`text-lg font-bold mt-1 ${summary.saldo >= 0 ? "text-primary" : "text-destructive"}`}>
                {formatCurrency(summary.saldo)}
              </p>
            </div>
          </div>

          {/* Recent transactions */}
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <p className="text-sm font-semibold">Movimentações da Sessão</p>
              {recent.length > 0 && <span className="text-xs text-muted-foreground">{recent.length} lançamento{recent.length !== 1 ? "s" : ""}</span>}
            </div>
            {recent.length > 0 ? (
              <div className="divide-y max-h-72 overflow-y-auto">
                {recent.map((t) => (
                  <div key={t.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {t.type === "income" ? (
                        <ArrowUpCircle className="w-4 h-4 text-primary shrink-0" />
                      ) : (
                        <ArrowDownCircle className="w-4 h-4 text-destructive shrink-0" />
                      )}
                      <span className="text-sm truncate">{t.description}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      <span className={`text-sm font-semibold ${t.type === "income" ? "text-primary" : "text-destructive"}`}>
                        {t.type === "income" ? "+" : "-"}{formatCurrency(t.amount)}
                      </span>
                      <span className="text-xs text-muted-foreground w-10 text-right">{fmtTime(t.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-muted-foreground">
                <Wallet className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhuma movimentação ainda.</p>
                <p className="text-xs mt-1">Use os botões acima para lançar entradas e saídas.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* History */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <button
          className="w-full px-4 py-3 flex items-center justify-between text-sm font-semibold hover:bg-muted/30 transition-colors"
          onClick={() => setHistExpanded((v) => !v)}
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-muted-foreground" />
            Histórico de Sessões
          </div>
          {histExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {histExpanded && (
          <div className="border-t">
            {history.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Nenhuma sessão encontrada.</p>
            ) : (
              <div className="divide-y">
                {history.map((h) => (
                  <div key={h.id} className="px-4 py-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {h.status === "open" ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary">Aberto</span>
                        ) : (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Fechado</span>
                        )}
                        <span className="text-xs text-muted-foreground">{fmtDate(h.openedAt)}</span>
                      </div>
                      {h.diferenca != null && (
                        <span className={`text-xs font-bold ${h.diferenca >= 0 ? "text-primary" : "text-destructive"}`}>
                          {h.diferenca >= 0 ? "+" : ""}{formatCurrency(h.diferenca)}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
                      <span>Fundo: <span className="text-foreground font-medium">{formatCurrency(h.initialAmount)}</span></span>
                      {h.totalEntradas != null && <span>Entradas: <span className="text-primary font-medium">{formatCurrency(h.totalEntradas)}</span></span>}
                      {h.totalSaidas != null && <span>Saídas: <span className="text-destructive font-medium">{formatCurrency(h.totalSaidas)}</span></span>}
                      {h.finalAmount != null && <span>Fechamento: <span className="text-foreground font-medium">{formatCurrency(h.finalAmount)}</span></span>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Aberto por <span className="text-foreground">{h.openedByName}</span>
                      {h.closedByName && <> · Fechado por <span className="text-foreground">{h.closedByName}</span></>}
                    </p>
                    {h.observations && <p className="text-xs italic text-muted-foreground">"{h.observations}"</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dialog: Lançar Saída / Entrada */}
      <Dialog open={movDialog !== null} onOpenChange={(v) => { if (!v) setMovDialog(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${movDialog === "expense" ? "text-destructive" : "text-primary"}`}>
              {movDialog === "expense"
                ? <><Minus className="w-5 h-5" /> Lançar Saída</>
                : <><Plus className="w-5 h-5" /> Lançar Entrada</>
              }
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            {/* Sugestões rápidas */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Sugestões rápidas</p>
              <div className="flex flex-wrap gap-1.5">
                {sugestoes.map((s) => (
                  <button
                    key={s}
                    onClick={() => setMovDesc(s)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      movDesc === s
                        ? movDialog === "expense"
                          ? "bg-red-500/15 border-red-500/40 text-red-500 font-medium"
                          : "bg-primary/15 border-primary/40 text-primary font-medium"
                        : "border-border text-muted-foreground hover:border-foreground/30"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Descrição</label>
              <Input
                placeholder="Ex: Compra de material"
                value={movDesc}
                onChange={(e) => setMovDesc(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Valor (R$)</label>
              <Input
                placeholder="0,00"
                value={movAmount}
                onChange={(e) => setMovAmount(e.target.value)}
                type="text"
                inputMode="decimal"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setMovDialog(null)}>Cancelar</Button>
            <Button
              onClick={() => movDialog && movMutation.mutate(movDialog)}
              disabled={movMutation.isPending}
              variant={movDialog === "expense" ? "destructive" : "default"}
              className="gap-2"
            >
              {movDialog === "expense" ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {movMutation.isPending ? "Salvando..." : movDialog === "expense" ? "Registrar Saída" : "Registrar Entrada"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Abrir Caixa */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LockOpen className="w-5 h-5 text-primary" /> Abrir Caixa
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Valor inicial (fundo de troco)</label>
              <Input
                placeholder="0,00"
                value={initialAmount}
                onChange={(e) => setInitialAmount(e.target.value)}
                type="text"
                inputMode="decimal"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">Dinheiro disponível ao abrir o caixa (troco, fundo, etc.)</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Observações <span className="text-muted-foreground font-normal">(opcional)</span></label>
              <Input
                placeholder="Ex: Caixa principal, turno da manhã..."
                value={openObs}
                onChange={(e) => setOpenObs(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpenDialog(false)}>Cancelar</Button>
            <Button onClick={() => openMutation.mutate()} disabled={openMutation.isPending} className="gap-2">
              <LockOpen className="w-4 h-4" />
              {openMutation.isPending ? "Abrindo..." : "Abrir Caixa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Fechar Caixa */}
      <Dialog open={closeDialog} onOpenChange={setCloseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-destructive" /> Fechar Caixa
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {summary && (
              <div className="bg-muted/40 rounded-lg p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fundo inicial</span>
                  <span className="font-medium">{formatCurrency(session!.initialAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Entradas</span>
                  <span className="font-medium text-primary">{formatCurrency(summary.entradas)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Saídas</span>
                  <span className="font-medium text-destructive">{formatCurrency(summary.saidas)}</span>
                </div>
                <div className="flex justify-between border-t pt-1.5 font-semibold">
                  <span>Saldo esperado</span>
                  <span className={summary.saldo >= 0 ? "text-primary" : "text-destructive"}>{formatCurrency(summary.saldo)}</span>
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Valor físico em caixa <span className="text-muted-foreground font-normal">(opcional)</span></label>
              <Input
                placeholder={summary ? String(summary.saldo.toFixed(2)).replace(".", ",") : "0,00"}
                value={finalAmount}
                onChange={(e) => setFinalAmount(e.target.value)}
                type="text"
                inputMode="decimal"
              />
              <p className="text-xs text-muted-foreground">Conte o dinheiro físico. Se vazio, usa o saldo calculado.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Observações <span className="text-muted-foreground font-normal">(opcional)</span></label>
              <Input
                placeholder="Ex: Turno encerrado, sangria realizada..."
                value={closeObs}
                onChange={(e) => setCloseObs(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCloseDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending} className="gap-2">
              <Lock className="w-4 h-4" />
              {closeMutation.isPending ? "Fechando..." : "Fechar Caixa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
