import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  BarChart2, Users, Truck, TrendingUp, Star, Clock,
  Package, ArrowUpCircle, ArrowDownCircle, ShoppingCart, Receipt, MessageCircle, Send, X,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";
import { useCompanySettings } from "@/hooks/use-company-settings";

type ProdSaleItem = { name: string; quantity: number; unitPrice: number };
type ProdSale = {
  id: number; clientName?: string | null; total: number;
  paymentMethod: string; paymentType: string;
  items: ProdSaleItem[]; returnTotal: number | null; createdAt: string;
};
type MovItem = { id: number; type: string; amount: number; description: string; category: string; createdAt: string };

type Resumo = {
  date: string;
  vendas: { total: number; count: number; comissao: number };
  comissoesPendentes: number;
  funcionarios: { total: number; presentes: number; faltas: number };
  entregas: { pendentes: number; emRota: number; entregues: number; problema: number; total: number };
  topEmployee: string | null;
  recentSales: { id: number; description: string; amount: number; commissionAmount: number; clientName?: string | null; createdAt: string }[];
  prodVendas: { total: number; count: number; items: ProdSale[] };
  movimentacoes: { entradas: number; saidas: number; saldo: number; items: MovItem[] };
};

function SummaryCard({ label, value, sub, icon: Icon, color }: { label: string; value: string | number; sub?: string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-card border rounded-xl p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <div className="p-2 rounded-lg" style={{ background: "hsl(var(--muted))" }}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
      </div>
    </div>
  );
}

const METHOD_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro", pix: "PIX", cartao_credito: "Crédito",
  cartao_debito: "Débito", boleto: "Boleto", transferencia: "TED/DOC",
};

const DELIVERY_STEPS = [
  { key: "pendentes", label: "Pendentes", color: "bg-amber-400" },
  { key: "emRota", label: "Em Rota", color: "bg-blue-500" },
  { key: "entregues", label: "Entregues", color: "bg-primary" },
  { key: "problema", label: "Problema", color: "bg-destructive" },
];

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function ResumoDiario() {
  const { data, isLoading, isError } = useQuery<Resumo>({
    queryKey: ["resumo-diario"],
    queryFn: async () => {
      const r = await fetch("/api/resumo-diario");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    refetchInterval: 30_000,
    retry: 1,
  });

  const { data: company } = useCompanySettings();
  const [showWaPanel, setShowWaPanel] = useState(false);
  const [waPhone, setWaPhone] = useState("");

  const hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const hojeCapitalized = hoje.charAt(0).toUpperCase() + hoje.slice(1);

  const buildMsg = () => {
    if (!data) return "";
    const saldo = data.movimentacoes.saldo;
    return [
      `📊 *Resumo do Dia — ${company?.name ?? "GestorX7"}*`,
      `📅 ${hojeCapitalized}`,
      ``,
      `🛒 *Vendas:* ${formatCurrency(data.prodVendas.total)} (${data.prodVendas.count} venda${data.prodVendas.count !== 1 ? "s" : ""})`,
      `💰 *Entradas:* ${formatCurrency(data.movimentacoes.entradas)}`,
      `💸 *Saídas:* ${formatCurrency(data.movimentacoes.saidas)}`,
      `💵 *Saldo do Dia:* ${saldo >= 0 ? "+" : ""}${formatCurrency(saldo)}`,
      ``,
      data.funcionarios.total > 0
        ? `👥 *Equipe:* ${data.funcionarios.presentes}/${data.funcionarios.total} presentes`
        : null,
      data.topEmployee ? `⭐ *Destaque:* ${data.topEmployee}` : null,
      ``,
      `_Enviado via GestorX7_`,
    ].filter((l) => l !== null).join("\n");
  };

  const handleSendWa = () => {
    const digits = waPhone.replace(/\D/g, "");
    if (!digits) return;
    const msg = buildMsg();
    const url = `https://wa.me/55${digits}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
    setShowWaPanel(false);
  };

  const handleOpenPanel = () => {
    const phone = (company?.phone ?? "").replace(/\D/g, "");
    setWaPhone(phone);
    setShowWaPanel(true);
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto animate-fade-in">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Resumo Diário</h1>
          <p className="text-muted-foreground text-sm mt-0.5 capitalize">{hojeCapitalized}</p>
        </div>
        {data && (
          <div className="shrink-0">
            {!showWaPanel ? (
              <button
                onClick={handleOpenPanel}
                className="flex items-center gap-2 px-3 py-2 bg-[#25D366] hover:bg-[#20bc5a] active:scale-95 text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
              >
                <MessageCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Enviar por WhatsApp</span>
                <span className="sm:hidden">WhatsApp</span>
              </button>
            ) : (
              <div className="bg-card border rounded-xl shadow-md p-3 flex flex-col gap-2 min-w-[240px] animate-fade-in">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Enviar resumo via WhatsApp</span>
                  <button onClick={() => setShowWaPanel(false)} className="p-1 hover:bg-muted rounded-lg transition-colors">
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground shrink-0 font-medium">+55</span>
                  <input
                    type="tel"
                    value={waPhone}
                    onChange={(e) => setWaPhone(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSendWa(); if (e.key === "Escape") setShowWaPanel(false); }}
                    placeholder="(11) 99999-9999"
                    autoFocus
                    className="flex-1 text-sm px-2.5 py-1.5 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-[#25D366]/40 focus:border-[#25D366] transition-all"
                  />
                </div>
                <button
                  onClick={handleSendWa}
                  disabled={!waPhone.replace(/\D/g, "")}
                  className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-[#25D366] hover:bg-[#20bc5a] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  Abrir WhatsApp
                </button>
                <p className="text-[10px] text-muted-foreground text-center">
                  Abrirá o WhatsApp com a mensagem pronta
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : isError ? (
        <div className="bg-card border rounded-xl p-8 text-center text-muted-foreground">
          <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-25" />
          <p className="text-sm font-medium mb-1">Não foi possível carregar o resumo</p>
          <p className="text-xs">Tente recarregar a página ou faça login novamente.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 px-4 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Recarregar
          </button>
        </div>
      ) : data ? (
        <div className="space-y-4">

          {/* KPI cards — vendas de produtos */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard
              label="Vendas do Dia"
              value={formatCurrency(data.prodVendas.total)}
              sub={`${data.prodVendas.count} venda${data.prodVendas.count !== 1 ? "s" : ""}`}
              icon={ShoppingCart}
              color="text-primary"
            />
            <SummaryCard
              label="Entradas Financeiras"
              value={formatCurrency(data.movimentacoes.entradas)}
              sub="receitas lançadas hoje"
              icon={ArrowUpCircle}
              color="text-primary"
            />
            <SummaryCard
              label="Saídas Financeiras"
              value={formatCurrency(data.movimentacoes.saidas)}
              sub="despesas lançadas hoje"
              icon={ArrowDownCircle}
              color={data.movimentacoes.saidas > 0 ? "text-destructive" : "text-muted-foreground"}
            />
            <SummaryCard
              label="Saldo do Dia"
              value={formatCurrency(data.movimentacoes.saldo)}
              sub="entradas − saídas"
              icon={Receipt}
              color={data.movimentacoes.saldo >= 0 ? "text-primary" : "text-destructive"}
            />
          </div>

          {/* Vendas de produtos — lista */}
          <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-sm">Vendas Realizadas</h2>
              {data.prodVendas.count > 0 && (
                <span className="ml-auto text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">
                  {data.prodVendas.count} venda{data.prodVendas.count !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            {data.prodVendas.items.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-25" />
                Nenhuma venda registrada hoje
              </div>
            ) : (
              <div className="divide-y">
                {data.prodVendas.items.map((s) => (
                  <div key={s.id} className="px-4 py-3 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold">{s.clientName ?? "Sem cliente"}</span>
                        <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                          {METHOD_LABEL[s.paymentMethod] ?? s.paymentMethod}
                        </span>
                        {s.paymentType === "aprazo" && (
                          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">A Prazo</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {s.items.map((it, i) => (
                          <span key={i} className="text-[11px] bg-muted/60 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            <Package className="w-2.5 h-2.5" />
                            {it.quantity}× {it.name}
                          </span>
                        ))}
                      </div>
                      {s.returnTotal && s.returnTotal > 0 && (
                        <span className="text-[10px] text-amber-700 font-medium">
                          Devolvido: -{formatCurrency(s.returnTotal)}
                        </span>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-primary">{formatCurrency(s.total)}</p>
                      <p className="text-[11px] text-muted-foreground">{fmtTime(s.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Movimentações financeiras */}
          <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-sm">Movimentações Financeiras</h2>
              {data.movimentacoes.items.length > 0 && (
                <span className="ml-auto text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">
                  {data.movimentacoes.items.length} lançamento{data.movimentacoes.items.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            {data.movimentacoes.items.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                <Receipt className="w-8 h-8 mx-auto mb-2 opacity-25" />
                Nenhuma movimentação lançada hoje
              </div>
            ) : (
              <div className="divide-y">
                {data.movimentacoes.items.map((t) => (
                  <div key={t.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${t.type === "income" ? "bg-primary/10" : "bg-destructive/10"}`}>
                        {t.type === "income"
                          ? <ArrowUpCircle className="w-3.5 h-3.5 text-primary" />
                          : <ArrowDownCircle className="w-3.5 h-3.5 text-destructive" />
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{t.description}</p>
                        {t.category && <p className="text-[11px] text-muted-foreground">{t.category}</p>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${t.type === "income" ? "text-primary" : "text-destructive"}`}>
                        {t.type === "income" ? "+" : "-"}{formatCurrency(t.amount)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{fmtTime(t.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Funcionários + Entregas */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard label="Funcionários Presentes" value={`${data.funcionarios.presentes}/${data.funcionarios.total}`} sub={data.funcionarios.faltas > 0 ? `${data.funcionarios.faltas} falta${data.funcionarios.faltas > 1 ? "s" : ""}` : "Todos presentes"} icon={Users} color={data.funcionarios.faltas > 0 ? "text-destructive" : "text-primary"} />
            <SummaryCard label="Comissões Hoje" value={formatCurrency(data.vendas.comissao)} sub="vendas da equipe" icon={TrendingUp} color="text-primary" />
            <SummaryCard label="Com. Pendentes" value={formatCurrency(data.comissoesPendentes)} sub="não quitadas" icon={Clock} color={data.comissoesPendentes > 0 ? "text-amber-500" : "text-muted-foreground"} />
            {data.topEmployee ? (
              <div className="bg-card border rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Destaque do Dia</p>
                    <p className="text-sm font-bold mt-1 text-primary truncate max-w-[120px]">{data.topEmployee}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">maior volume</p>
                  </div>
                  <div className="p-2 rounded-lg" style={{ background: "hsl(var(--muted))" }}>
                    <Star className="w-4 h-4 text-amber-500" />
                  </div>
                </div>
              </div>
            ) : (
              <SummaryCard label="Entregas Entregues" value={data.entregas.entregues} sub={`de ${data.entregas.total} total`} icon={Truck} color="text-primary" />
            )}
          </div>

          {/* Progresso de entregas */}
          {data.entregas.total > 0 && (
            <div className="bg-card border rounded-xl shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Truck className="w-4 h-4 text-primary" />
                <h2 className="font-semibold text-sm">Progresso de Entregas</h2>
                <span className="ml-auto text-xs text-muted-foreground">{data.entregas.total} total</span>
              </div>
              <div className="flex rounded-full overflow-hidden h-3 mb-3 gap-0.5">
                {DELIVERY_STEPS.map((s) => {
                  const val = data.entregas[s.key as keyof typeof data.entregas] as number;
                  const pct = data.entregas.total > 0 ? (val / data.entregas.total) * 100 : 0;
                  return pct > 0 ? <div key={s.key} className={`${s.color} transition-all duration-700`} style={{ width: `${pct}%` }} /> : null;
                })}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {DELIVERY_STEPS.map((s) => {
                  const val = data.entregas[s.key as keyof typeof data.entregas] as number;
                  return (
                    <div key={s.key} className="text-center">
                      <div className={`inline-block w-2.5 h-2.5 rounded-full ${s.color} mr-1`} />
                      <span className="text-xs text-muted-foreground">{s.label}</span>
                      <p className="text-lg font-bold">{val}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      ) : null}
    </div>
  );
}
