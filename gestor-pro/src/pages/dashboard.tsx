import { useState } from "react";
import { useGetDashboardSummary, useGetTodayTasks, useGetAlerts } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { AlertTriangle, Users, DollarSign, Calendar, Package, FileText, TrendingUp, TrendingDown, Clock, BarChart2, HandCoins } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { authFetch } from "@/lib/auth-fetch";
import { Skeleton } from "@/components/ui/skeleton";

type Period = "weekly" | "monthly" | "annual";

function StatCard({
  label, value, sub, icon: Icon, accent,
}: {
  label: string; value: string; sub?: string; icon: React.ElementType; accent?: boolean;
}) {
  return (
    <div className="bg-card border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground font-medium leading-tight">{label}</p>
          <p className={`text-xl font-bold mt-1 ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{sub}</p>}
        </div>
        <div className={`p-2 rounded-lg shrink-0 ml-2 ${accent ? "bg-primary/10" : "bg-muted"}`}>
          <Icon className={`w-4 h-4 ${accent ? "text-primary" : "text-muted-foreground"}`} />
        </div>
      </div>
    </div>
  );
}

const PERIOD_LABELS: Record<Period, string> = {
  weekly: "Semanal",
  monthly: "Mensal",
  annual: "Anual",
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border rounded-xl shadow-lg px-4 py-3 text-sm min-w-[170px]">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 mb-1">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-bold" style={{ color: p.color }}>{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

function RevenueChart() {
  const [period, setPeriod] = useState<Period>("monthly");
  const [chartType, setChartType] = useState<"area" | "bar">("area");

  const { data = [], isLoading } = useQuery({
    queryKey: ["revenue-chart", period],
    queryFn: async () => {
      const res = await authFetch(`${API}/dashboard/revenue-chart?period=${period}`);
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : [];
    },
    staleTime: 60_000,
  });

  const safeData = Array.isArray(data) ? data : [];
  const totalReceitas = safeData.reduce((s: number, d: any) => s + d.receitas, 0);
  const totalDespesas = safeData.reduce((s: number, d: any) => s + d.despesas, 0);
  const totalLucro = totalReceitas - totalDespesas;

  return (
    <div className="bg-card border rounded-xl shadow-sm overflow-hidden mb-5">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-muted/30 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <BarChart2 className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-sm md:text-base">Receitas & Despesas</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period toggles */}
          <div className="flex bg-muted rounded-lg p-0.5 gap-0.5">
            {(["weekly", "monthly", "annual"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  period === p ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
          {/* Chart type toggle */}
          <div className="flex bg-muted rounded-lg p-0.5 gap-0.5">
            <button onClick={() => setChartType("area")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${chartType === "area" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
              Área
            </button>
            <button onClick={() => setChartType("bar")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${chartType === "bar" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
              Barras
            </button>
          </div>
        </div>
      </div>

      {/* Summary mini-cards */}
      <div className="grid grid-cols-3 gap-3 px-4 pt-4">
        <div className="text-center">
          <p className="text-[11px] text-muted-foreground">Total Receitas</p>
          <p className="text-sm font-bold text-primary">{formatCurrency(totalReceitas)}</p>
        </div>
        <div className="text-center">
          <p className="text-[11px] text-muted-foreground">Total Despesas</p>
          <p className="text-sm font-bold text-destructive">{formatCurrency(totalDespesas)}</p>
        </div>
        <div className="text-center">
          <p className="text-[11px] text-muted-foreground">Lucro Líquido</p>
          <p className={`text-sm font-bold ${totalLucro >= 0 ? "text-primary" : "text-destructive"}`}>{formatCurrency(totalLucro)}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="px-2 pb-4 pt-3">
        {isLoading ? (
          <Skeleton className="h-52 w-full rounded-lg" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            {chartType === "area" ? (
              <AreaChart data={safeData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradReceitas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142,72%,38%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(142,72%,38%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradDespesas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(0,72%,51%)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(0,72%,51%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} width={42} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  formatter={(name) => <span style={{ color: "hsl(var(--foreground))" }}>{name}</span>} />
                <Area type="monotone" dataKey="receitas" name="Receitas" stroke="hsl(142,72%,38%)" strokeWidth={2} fill="url(#gradReceitas)" dot={false} activeDot={{ r: 4, fill: "hsl(142,72%,38%)" }} />
                <Area type="monotone" dataKey="despesas" name="Despesas" stroke="hsl(0,72%,51%)" strokeWidth={2} fill="url(#gradDespesas)" dot={false} activeDot={{ r: 4, fill: "hsl(0,72%,51%)" }} />
              </AreaChart>
            ) : (
              <BarChart data={safeData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} width={42} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  formatter={(name) => <span style={{ color: "hsl(var(--foreground))" }}>{name}</span>} />
                <Bar dataKey="receitas" name="Receitas" fill="hsl(142,72%,38%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesas" name="Despesas" fill="hsl(0,72%,51%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary();
  const { data: todayTasks = [], isLoading: tasksLoading } = useGetTodayTasks();
  const { data: alerts = [], isLoading: alertsLoading } = useGetAlerts();
  const { data: collections = [], isLoading: collectionsLoading } = useQuery<any[]>({
    queryKey: ["today-collections"],
    queryFn: () => authFetch("/api/dashboard/today-collections").then((r) => r.json()),
  });

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-5">
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Visão geral do seu negócio</p>
      </div>

      {/* Alert Banner */}
      {!alertsLoading && alerts.length > 0 && (
        <div className="mb-5 space-y-2">
          {(alerts as any[]).map((alert, i) => (
            <div
              key={alert.id}
              style={{ animationDelay: `${i * 50}ms` }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium animate-fade-in ${
                alert.severity === "danger"
                  ? "bg-primary/8 border-primary/25 text-primary"
                  : "bg-red-50 border-red-200 text-red-800"
              }`}
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="line-clamp-1">{alert.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {summaryLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))
        ) : summary ? (
          <>
            <StatCard label="Saldo Atual" value={formatCurrency((summary as any).balance)} icon={DollarSign} accent={(summary as any).balance >= 0} />
            <StatCard label="A Receber" value={formatCurrency((summary as any).totalReceivable)} sub={(summary as any).totalReceivableSub ?? ((summary as any).totalReceivable === 0 ? "Em dia" : undefined)} icon={TrendingUp} accent={(summary as any).totalReceivable > 0} />
            <StatCard label="Total de Clientes" value={String((summary as any).totalClients)} sub={(summary as any).totalDebtorClients > 0 ? `${(summary as any).totalDebtorClients} devedores` : "Nenhum devedor"} icon={Users} />
            <StatCard label="Tarefas Hoje" value={String((summary as any).todayTasksCount)} sub={(summary as any).overdueTasksCount > 0 ? `${(summary as any).overdueTasksCount} atrasadas` : "Em dia"} icon={Calendar} accent={(summary as any).overdueTasksCount > 0} />
            <StatCard label="Tarefas Atrasadas" value={String((summary as any).overdueTasksCount)} icon={Clock} accent={(summary as any).overdueTasksCount > 0} />
            <StatCard label="Estoque Baixo" value={String((summary as any).lowStockItemsCount)} icon={Package} accent={(summary as any).lowStockItemsCount > 0} />
            <StatCard label="Orçamentos Pendentes" value={String((summary as any).pendingQuotesCount)} icon={FileText} />
            <StatCard label="Total Despesas" value={formatCurrency((summary as any).totalExpenses ?? 0)} icon={TrendingDown} />
          </>
        ) : null}
      </div>

      {/* Revenue Chart */}
      <RevenueChart />

      {/* Cobranças do Dia */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden mb-5">
        <div className="px-4 py-3 border-b flex items-center gap-2 bg-muted/30">
          <HandCoins className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-sm md:text-base">Cobranças</h2>
          {collections.length > 0 && (
            <span className="ml-auto text-xs bg-primary text-white px-2 py-0.5 rounded-full font-bold">
              {collections.length}
            </span>
          )}
        </div>
        <div className="divide-y">
          {collectionsLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          ) : collections.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              <HandCoins className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Nenhuma cobrança pendente
            </div>
          ) : (
            collections.map((c: any) => (
              <div key={c.id} className="px-4 py-3.5 flex items-center gap-3 hover:bg-muted/20 transition-colors">
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${c.isOverdue ? "bg-destructive animate-pulse" : c.isDueToday ? "bg-primary animate-pulse" : "bg-yellow-500"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.debtDueDate ? (c.isOverdue ? `Venceu em ${formatDate(c.debtDueDate)}` : c.isDueToday ? "Vence hoje" : `Vence em ${formatDate(c.debtDueDate)}`) : "Sem vencimento"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold ${c.isOverdue ? "text-destructive" : "text-primary"}`}>{formatCurrency(c.debtAmount)}</p>
                  {c.isOverdue && <span className="text-xs text-destructive font-semibold">Atrasado</span>}
                  {c.isDueToday && !c.isOverdue && <span className="text-xs text-primary font-semibold">Hoje</span>}
                </div>
              </div>
            ))
          )}
        </div>
        {collections.length > 0 && (
          <div className="px-4 py-2.5 border-t bg-muted/10 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Total a receber</span>
            <span className="text-sm font-bold text-primary">{formatCurrency(collections.reduce((s: number, c: any) => s + c.debtAmount, 0))}</span>
          </div>
        )}
      </div>

      {/* Today Tasks */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-2 bg-muted/30">
          <Calendar className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-sm md:text-base">Serviços do Dia</h2>
          {todayTasks.length > 0 && (
            <span className="ml-auto text-xs bg-primary text-white px-2 py-0.5 rounded-full font-bold">
              {todayTasks.length}
            </span>
          )}
        </div>
        <div className="divide-y">
          {tasksLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          ) : todayTasks.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Nenhum serviço agendado para hoje
            </div>
          ) : (
            (todayTasks as any[]).map((task) => (
              <div key={task.id} className="px-4 py-3.5 flex items-center gap-3 hover:bg-muted/20 transition-colors">
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${task.isOverdue ? "bg-destructive animate-pulse" : "bg-primary"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{task.title}</p>
                  {task.clientName && <p className="text-xs text-muted-foreground">{task.clientName}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">{formatDate(task.dueDate)}</p>
                  {task.isOverdue && <span className="text-xs text-primary font-semibold">Atrasado</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
