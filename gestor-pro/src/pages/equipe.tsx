import { useState, useEffect } from "react";
import { useConfirm } from "@/hooks/use-confirm";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus, Users, Truck, Calendar, Pencil, Trash2,
  CheckCircle2, Clock, AlertTriangle, Phone,
  DollarSign, TrendingUp, Award, ChevronDown, ChevronUp, CheckCheck, ShoppingBag, Search, X, FileText, LogIn, LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/format";

// ─── Types ─────────────────────────────────────────────────────────
type Employee = { id: number; name: string; role: string; phone: string; commissionRate: number; commissionPeriod: string; commissionLimit: number | null; active: boolean; createdAt: string };
type Schedule = { id: number; employeeId: number; date: string; startTime: string; endTime: string; status: string; notes?: string | null };
type Delivery = { id: number; title: string; clientName?: string | null; employeeName?: string | null; employeeId?: number | null; status: string; deliveryDate?: string | null; address?: string | null; notes?: string | null; createdAt: string };

// ─── Schemas ───────────────────────────────────────────────────────
const empSchema = z.object({
  name: z.string().min(1, "Obrigatório"),
  role: z.string().min(1, "Obrigatório"),
  phone: z.string().default(""),
  commissionRate: z.number().min(0).max(100).default(0),
  commissionPeriod: z.enum(["mensal", "semanal", "quinzenal"]).default("mensal"),
  commissionLimit: z.number().min(0).optional().nullable(),
  active: z.boolean().default(true),
});

const scheduleSchema = z.object({
  employeeId: z.number().int(),
  date: z.string().min(1, "Data obrigatória"),
  startTime: z.string().default(""),
  endTime: z.string().default(""),
  status: z.enum(["presente", "falta", "atestado", "folga"]).default("presente"),
  notes: z.string().optional(),
});

const deliverySchema = z.object({
  title: z.string().min(1, "Obrigatório"),
  clientName: z.string().optional(),
  employeeId: z.number().int().optional().nullable(),
  employeeName: z.string().optional(),
  deliveryDate: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

type Tab = "vendedores" | "comissoes" | "horarios" | "entregas";

const DELIVERY_STATUS = [
  { value: "pendente",  label: "Pendente",   color: "bg-amber-100 text-amber-800",  dot: "bg-amber-400" },
  { value: "em_rota",   label: "Em Rota",    color: "bg-blue-100 text-blue-800",    dot: "bg-blue-500" },
  { value: "entregue",  label: "Entregue",   color: "bg-primary/10 text-primary",   dot: "bg-primary" },
  { value: "problema",  label: "Problema",   color: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
];

const SCHEDULE_STATUS = [
  { value: "presente", label: "Presente",  color: "bg-primary/10 text-primary" },
  { value: "falta",    label: "Falta",     color: "bg-destructive/10 text-destructive" },
  { value: "atestado", label: "Atestado",  color: "bg-amber-100 text-amber-800" },
  { value: "folga",    label: "Folga",     color: "bg-muted text-muted-foreground" },
];

function deliveryStatusInfo(s: string) { return DELIVERY_STATUS.find((x) => x.value === s) ?? DELIVERY_STATUS[0]; }
function scheduleStatusColor(s: string) { return SCHEDULE_STATUS.find((x) => x.value === s)?.color ?? "bg-muted text-muted-foreground"; }

// ─────────────────────────────────────────────────────────────────
// VENDEDORES TAB
// ─────────────────────────────────────────────────────────────────
type CommissionSummary = { employee: { id: number }; grossCommission: number; pendingCommission: number; paidCommission: number; period: { label: string }; totalSalesCount: number };

function VendedoresTab({ employees, isLoading, onRefresh }: { employees: Employee[]; isLoading: boolean; onRefresh: () => void }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [empSearch, setEmpSearch] = useState("");
  const [historyEmp, setHistoryEmp] = useState<{ id: number; name: string } | null>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof empSchema>>({ resolver: zodResolver(empSchema), defaultValues: { name: "", role: "", phone: "", commissionRate: 0, commissionPeriod: "mensal", commissionLimit: null, active: true } });

  const { data: commSummary = [] } = useQuery<CommissionSummary[]>({
    queryKey: ["commissions-summary"],
    queryFn: () => fetch("/api/commissions/summary").then((r) => r.json()),
  });

  const commMap = commSummary.reduce<Record<number, CommissionSummary>>((acc, s) => { acc[s.employee.id] = s; return acc; }, {});

  const createEmp = useMutation({ mutationFn: (d: z.infer<typeof empSchema>) => fetch("/api/employees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }).then((r) => r.json()), onSuccess: () => { onRefresh(); setDialogOpen(false); form.reset(); toast({ title: "Funcionário cadastrado" }); } });
  const updateEmp = useMutation({ mutationFn: ({ id, ...d }: { id: number } & z.infer<typeof empSchema>) => fetch(`/api/employees/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }).then((r) => r.json()), onSuccess: () => { onRefresh(); setDialogOpen(false); toast({ title: "Salvo" }); } });
  const deleteEmp = useMutation({ mutationFn: (id: number) => fetch(`/api/employees/${id}`, { method: "DELETE" }), onSuccess: () => { onRefresh(); toast({ title: "Removido" }); } });

  const openEdit = (e: Employee) => { setEditEmp(e); form.reset({ name: e.name, role: e.role, phone: e.phone, commissionRate: e.commissionRate, commissionPeriod: (e.commissionPeriod as any) ?? "mensal", commissionLimit: e.commissionLimit ?? null, active: e.active }); setDialogOpen(true); };

  const PERIOD_LABEL: Record<string, string> = { mensal: "Mensal", semanal: "Semanal", quinzenal: "Quinzenal" };

  const esq = empSearch.toLowerCase();
  const filteredEmps = esq
    ? employees.filter((e) => e.name.toLowerCase().includes(esq) || e.role.toLowerCase().includes(esq))
    : employees;

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar funcionário por nome ou cargo..."
            value={empSearch}
            onChange={(e) => setEmpSearch(e.target.value)}
            className="pl-9"
          />
          {empSearch && (
            <button onClick={() => setEmpSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
        <Button size="sm" onClick={() => { setEditEmp(null); form.reset({ name: "", role: "", phone: "", commissionRate: 0, commissionPeriod: "mensal", commissionLimit: null, active: true }); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" />Novo
        </Button>
      </div>

      {employees.length === 0 ? (
        <div className="bg-card border rounded-xl p-10 text-center text-muted-foreground"><Users className="w-10 h-10 mx-auto mb-3 opacity-25" /><p className="text-sm">Nenhum funcionário cadastrado</p><p className="text-xs mt-1">Cadastre funcionários para vinculá-los às vendas</p></div>
      ) : filteredEmps.length === 0 ? (
        <div className="bg-card border rounded-xl p-10 text-center text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-25" />
          <p className="text-sm">Nenhum resultado para "{empSearch}"</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEmps.map((emp) => (
            <div key={emp.id} className="bg-card border rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                    {emp.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold">{emp.name}</p>
                    <p className="text-xs text-muted-foreground">{emp.role}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">
                        {emp.commissionRate}% comissão
                      </span>
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                        {PERIOD_LABEL[emp.commissionPeriod ?? "mensal"] ?? "Mensal"}
                      </span>
                      {emp.commissionLimit != null && emp.commissionLimit > 0 && (
                        <span className="text-xs text-muted-foreground">
                          · teto {formatCurrency(emp.commissionLimit)}
                        </span>
                      )}
                    </div>
                    {/* Badge de comissão do período atual */}
                    {commMap[emp.id] && commMap[emp.id].grossCommission > 0 && (
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          {formatCurrency(commMap[emp.id].grossCommission)} este período
                        </span>
                        {commMap[emp.id].pendingCommission > 0 && (
                          <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-500 font-semibold px-2 py-0.5 rounded-full">
                            {formatCurrency(commMap[emp.id].pendingCommission)} a pagar
                          </span>
                        )}
                        {commMap[emp.id].paidCommission > 0 && commMap[emp.id].pendingCommission === 0 && (
                          <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-semibold px-2 py-0.5 rounded-full">
                            pago ✓
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          · {commMap[emp.id].totalSalesCount} venda{commMap[emp.id].totalSalesCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    )}
                    {emp.phone && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" />{emp.phone}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setHistoryEmp({ id: emp.id, name: emp.name })} className="p-2 hover:bg-primary/10 rounded-lg" title="Histórico de vendas">
                    <ShoppingBag className="w-3.5 h-3.5 text-primary/70" />
                  </button>
                  <button onClick={() => openEdit(emp)} className="p-2 hover:bg-muted rounded-lg" title="Editar">
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={async () => { if (await askConfirm({ title: "Remover funcionário", description: `Tem certeza que deseja remover ${emp.name}?`, confirmText: "Remover", variant: "destructive" })) deleteEmp.mutate(emp.id); }} className="p-2 hover:bg-destructive/10 rounded-lg" title="Remover">
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Employee dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle>{editEmp ? "Editar Funcionário" : "Novo Funcionário"}</DialogTitle>
            <DialogDescription>Cadastre o funcionário com cargo e configuração de comissão.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((d) => editEmp ? updateEmp.mutate({ id: editEmp.id, ...d }) : createEmp.mutate(d))} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Nome</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem><FormLabel>Cargo</FormLabel><FormControl><Input {...field} placeholder="Ex: Vendedor" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>Telefone (opcional)</FormLabel><FormControl><Input {...field} placeholder="(00) 00000-0000" /></FormControl></FormItem>
              )} />
              <div className="border rounded-xl p-3 space-y-3 bg-muted/20">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Comissão</p>
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="commissionRate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Taxa (%)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" min="0" max="100" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} />
                      </FormControl>
                      <p className="text-[11px] text-muted-foreground">% padrão por venda</p>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="commissionLimit" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Limite (R$)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" placeholder="Sem limite"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)} />
                      </FormControl>
                      <p className="text-[11px] text-muted-foreground">Máx. por período</p>
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="commissionPeriod" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Período de referência</FormLabel>
                    <div className="grid grid-cols-3 gap-1.5">
                      {([["mensal", "Mensal"], ["quinzenal", "Quinzenal"], ["semanal", "Semanal"]] as const).map(([v, l]) => (
                        <button key={v} type="button" onClick={() => field.onChange(v)}
                          className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${field.value === v ? "bg-primary text-white border-primary" : "bg-card text-muted-foreground"}`}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </FormItem>
                )} />
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createEmp.isPending || updateEmp.isPending}>{editEmp ? "Salvar" : "Cadastrar"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Histórico de Vendas ──────────────────────────────── */}
      {historyEmp && (() => {
        const summary = (commSummary as any[]).find((s: any) => s.employee.id === historyEmp.id);
        const sales: CommSale[] = summary?.sales ?? [];
        const totalVendas = summary?.totalSalesAmount ?? 0;
        const released = summary?.releasedCommission ?? 0;
        const blocked = summary?.blockedCommission ?? 0;
        const paid = summary?.paidCommission ?? 0;
        return (
          <Dialog open onOpenChange={() => setHistoryEmp(null)}>
            <DialogContent className="max-w-lg max-h-[88vh] flex flex-col">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-primary" />
                  Histórico de Vendas — {historyEmp.name}
                </DialogTitle>
                <DialogDescription>{summary?.period?.label ?? "Período atual"} · {sales.length} venda{sales.length !== 1 ? "s" : ""}</DialogDescription>
              </DialogHeader>

              {/* Resumo */}
              <div className="grid grid-cols-4 gap-2 shrink-0">
                <div className="bg-card border rounded-lg p-2 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">Total</p>
                  <p className="text-sm font-bold text-primary">{formatCurrency(totalVendas)}</p>
                </div>
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-primary uppercase">Liberada</p>
                  <p className="text-sm font-bold text-primary">{formatCurrency(released)}</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-amber-700 uppercase">Bloqueada</p>
                  <p className="text-sm font-bold text-amber-700">{formatCurrency(blocked)}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-emerald-700 uppercase">Pago</p>
                  <p className="text-sm font-bold text-emerald-700">{formatCurrency(paid)}</p>
                </div>
              </div>

              {/* Lista de vendas */}
              <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                {sales.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-25" />
                    Nenhuma venda no período
                  </div>
                ) : sales.map((sale) => {
                  const isAprazo = sale.paymentType === "aprazo";
                  return (
                    <div key={`${sale.source}-${sale.id}`}
                      className={`flex items-start gap-3 rounded-lg px-3 py-2.5 text-xs border
                        ${sale.commissionPaid ? "bg-emerald-50/50 border-emerald-100"
                          : isAprazo ? "bg-amber-50/50 border-amber-100"
                          : "bg-muted/30 border-transparent"}`}>
                      <div className="mt-0.5">
                        {sale.source === "orcamento"
                          ? <FileText className="w-3.5 h-3.5 text-blue-400" />
                          : <ShoppingBag className={`w-3.5 h-3.5 ${isAprazo && !sale.commissionPaid ? "text-amber-500" : sale.commissionPaid ? "text-emerald-500" : "text-muted-foreground"}`} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 flex-wrap">
                          {sale.source === "orcamento" && <span className="bg-blue-100 text-blue-600 px-1 rounded font-bold">Orç.</span>}
                          <span className={`px-1 rounded font-bold ${isAprazo ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary"}`}>
                            {isAprazo ? "🔒 A Prazo" : "✓ À Vista"}
                          </span>
                          {sale.commissionPaid && <span className="bg-emerald-100 text-emerald-700 px-1 rounded font-bold">Comis. Paga</span>}
                        </div>
                        <p className="font-medium mt-0.5 truncate">
                          {sale.items.map((i) => `${i.name} (${i.quantity}x)`).join(", ") || (sale.source === "orcamento" ? "Orçamento convertido" : "Venda")}
                        </p>
                        {sale.clientName && <p className="text-muted-foreground truncate">Cliente: {sale.clientName}</p>}
                        <p className="text-muted-foreground">{new Date(sale.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-primary">{formatCurrency(sale.total)}</p>
                        <p className={`font-semibold ${sale.commissionPaid ? "text-emerald-600" : isAprazo ? "text-amber-600" : "text-foreground"}`}>
                          com. {formatCurrency(sale.commissionAmount)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{sale.commissionPct}%</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <DialogFooter className="shrink-0">
                <Button variant="outline" onClick={() => setHistoryEmp(null)}>Fechar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// HORÁRIOS TAB
// ─────────────────────────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex flex-col items-center py-3 bg-primary/5 border border-primary/20 rounded-xl">
      <Clock className="w-5 h-5 text-primary mb-1" />
      <span className="text-3xl font-mono font-bold text-primary tabular-nums tracking-tight">
        {time.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </span>
      <span className="text-xs text-muted-foreground mt-0.5">
        {time.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
      </span>
    </div>
  );
}

function HorariosTab({ employees, isLoading }: { employees: Employee[]; isLoading: boolean }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split("T")[0]);
  const [entradaTime, setEntradaTime] = useState<string | null>(null);
  const [saidaTime, setSaidaTime] = useState<string | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: schedules = [], isLoading: schedLoading } = useQuery<Schedule[]>({
    queryKey: ["schedules", filterDate],
    queryFn: () => fetch(`/api/schedules?date=${filterDate}`).then((r) => r.json()),
  });

  const getNow = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const form = useForm<z.infer<typeof scheduleSchema>>({ resolver: zodResolver(scheduleSchema), defaultValues: { employeeId: 0, date: filterDate, startTime: "", endTime: "", status: "presente" } });

  const create = useMutation({
    mutationFn: (d: z.infer<typeof scheduleSchema>) => fetch("/api/schedules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["schedules"] }); setDialogOpen(false); form.reset(); setEntradaTime(null); setSaidaTime(null); toast({ title: "Ponto registrado" }); },
  });
  const remove = useMutation({
    mutationFn: (id: number) => fetch(`/api/schedules/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedules"] }),
  });
  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => fetch(`/api/schedules/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedules"] }),
  });

  const openDialog = () => {
    setEntradaTime(null);
    setSaidaTime(null);
    form.reset({ employeeId: employees[0]?.id ?? 0, date: filterDate, startTime: "", endTime: "", status: "presente" });
    setDialogOpen(true);
  };

  const handleBaterEntrada = () => {
    const now = getNow();
    setEntradaTime(now);
    form.setValue("startTime", now);
  };

  const handleBaterSaida = () => {
    const now = getNow();
    setSaidaTime(now);
    form.setValue("endTime", now);
  };

  const employeeName = (id: number) => employees.find((e) => e.id === id)?.name ?? "—";

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-auto" />
        <div className="ml-auto">
          <Button size="sm" onClick={openDialog}>
            <Plus className="w-4 h-4 mr-1" />Registrar Ponto
          </Button>
        </div>
      </div>

      {schedLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : schedules.length === 0 ? (
        <div className="bg-card border rounded-xl p-10 text-center text-muted-foreground">
          <Calendar className="w-10 h-10 mx-auto mb-3 opacity-25" />
          <p className="text-sm">Nenhum ponto registrado para esta data</p>
        </div>
      ) : (
        <div className="space-y-2">
          {schedules.map((s) => (
            <div key={s.id} className="bg-card border rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                {employeeName(s.employeeId).charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{employeeName(s.employeeId)}</p>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  <span className="flex items-center gap-1 text-xs">
                    <LogIn className="w-3 h-3 text-primary" />
                    <span className="text-muted-foreground">Entrada:</span>
                    <span className="font-semibold text-primary">{s.startTime || "—"}</span>
                  </span>
                  <span className="flex items-center gap-1 text-xs">
                    <LogOut className="w-3 h-3 text-amber-600" />
                    <span className="text-muted-foreground">Saída:</span>
                    <span className="font-semibold text-amber-600">{s.endTime || "—"}</span>
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select value={s.status} onChange={(e) => updateStatus.mutate({ id: s.id, status: e.target.value })}
                  className={`text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer outline-none ${scheduleStatusColor(s.status)}`}>
                  {SCHEDULE_STATUS.map((st) => <option key={st.value} value={st.value}>{st.label}</option>)}
                </select>
                {s.notes && <span className="text-xs text-muted-foreground hidden sm:block truncate max-w-[80px]">{s.notes}</span>}
                <button onClick={() => remove.mutate(s.id)} className="p-1.5 hover:bg-destructive/10 rounded-lg shrink-0">
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setEntradaTime(null); setSaidaTime(null); } setDialogOpen(open); }}>
        <DialogContent className="max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle>Registrar Ponto</DialogTitle>
            <DialogDescription>Clique no botão de Entrada ou Saída para capturar o horário atual.</DialogDescription>
          </DialogHeader>
          <LiveClock />
          <Form {...form}>
            <form onSubmit={form.handleSubmit((d) => create.mutate(d))} className="space-y-4">
              <FormField control={form.control} name="employeeId" render={({ field }) => (
                <FormItem><FormLabel>Funcionário</FormLabel>
                  <select {...field} onChange={(e) => field.onChange(Number(e.target.value))} value={field.value}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background">
                    <option value={0} disabled>Selecione...</option>
                    {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                <FormMessage /></FormItem>
              )} />

              {/* Botões clicáveis de Entrada e Saída */}
              <div className="grid grid-cols-2 gap-3">
                {/* ENTRADA */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Entrada</label>
                  {entradaTime ? (
                    <div className="flex items-center gap-2 px-3 py-3 rounded-xl border-2 border-primary bg-primary/5">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-base font-mono font-bold text-primary">{entradaTime}</span>
                      <button type="button" onClick={() => { setEntradaTime(null); form.setValue("startTime", ""); }}
                        className="ml-auto text-muted-foreground hover:text-destructive transition-colors" title="Refazer">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={handleBaterEntrada}
                      className="flex flex-col items-center justify-center gap-1 px-3 py-4 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 hover:border-primary hover:bg-primary/10 active:scale-95 transition-all text-primary">
                      <Clock className="w-5 h-5" />
                      <span className="text-xs font-semibold">Bater Entrada</span>
                    </button>
                  )}
                </div>

                {/* SAÍDA */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Saída</label>
                  {saidaTime ? (
                    <div className="flex items-center gap-2 px-3 py-3 rounded-xl border-2 border-amber-500 bg-amber-50">
                      <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="text-base font-mono font-bold text-amber-700">{saidaTime}</span>
                      <button type="button" onClick={() => { setSaidaTime(null); form.setValue("endTime", ""); }}
                        className="ml-auto text-muted-foreground hover:text-destructive transition-colors" title="Refazer">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={handleBaterSaida}
                      className="flex flex-col items-center justify-center gap-1 px-3 py-4 rounded-xl border-2 border-dashed border-amber-400/60 bg-amber-50/50 hover:border-amber-500 hover:bg-amber-50 active:scale-95 transition-all text-amber-600">
                      <Clock className="w-5 h-5" />
                      <span className="text-xs font-semibold">Bater Saída</span>
                    </button>
                  )}
                </div>
              </div>

              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem><FormLabel>Status</FormLabel>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {SCHEDULE_STATUS.map((s) => (
                      <button key={s.value} type="button" onClick={() => field.onChange(s.value)}
                        className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${field.value === s.value ? "bg-primary text-white border-primary" : "bg-card text-muted-foreground border"}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </FormItem>
              )} />
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Obs. (opcional)</FormLabel><FormControl><Input {...field} placeholder="Ex: Saiu mais cedo" /></FormControl></FormItem>
              )} />
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={create.isPending || (!entradaTime && !saidaTime)}>
                  Registrar Ponto
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ENTREGAS TAB
// ─────────────────────────────────────────────────────────────────
function EntregasTab({ employees }: { employees: Employee[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState("todos");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: deliveries = [], isLoading } = useQuery<Delivery[]>({
    queryKey: ["deliveries"],
    queryFn: () => fetch("/api/deliveries").then((r) => r.json()),
  });

  const form = useForm<z.infer<typeof deliverySchema>>({ resolver: zodResolver(deliverySchema), defaultValues: { title: "", clientName: "", employeeId: null, deliveryDate: "", address: "", notes: "" } });

  const create = useMutation({
    mutationFn: (d: z.infer<typeof deliverySchema>) => {
      const emp = d.employeeId ? employees.find((e) => e.id === d.employeeId) : null;
      return fetch("/api/deliveries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...d, employeeName: emp?.name ?? null }) }).then((r) => r.json());
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["deliveries"] }); qc.invalidateQueries({ queryKey: ["resumo-diario"] }); setDialogOpen(false); form.reset(); toast({ title: "Entrega cadastrada" }); },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => fetch(`/api/deliveries/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["deliveries"] }); qc.invalidateQueries({ queryKey: ["resumo-diario"] }); },
  });

  const remove = useMutation({
    mutationFn: (id: number) => fetch(`/api/deliveries/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deliveries"] }),
  });

  const filtered = filterStatus === "todos" ? deliveries : deliveries.filter((d) => d.status === filterStatus);
  const counts = DELIVERY_STATUS.reduce((acc, s) => { acc[s.value] = deliveries.filter((d) => d.status === s.value).length; return acc; }, {} as Record<string, number>);

  // Progress percentage
  const totalDeliveries = deliveries.length;
  const entregues = deliveries.filter((d) => d.status === "entregue").length;
  const progressPct = totalDeliveries > 0 ? Math.round((entregues / totalDeliveries) * 100) : 0;

  return (
    <div>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        {/* Progress pill */}
        {totalDeliveries > 0 && (
          <div className="flex items-center gap-2 bg-muted/50 rounded-full px-3 py-1.5">
            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="text-xs font-semibold">{progressPct}% entregues</span>
          </div>
        )}
        <div className="ml-auto">
          <Button size="sm" onClick={() => { form.reset({ title: "", clientName: "", employeeId: null, deliveryDate: new Date().toISOString().split("T")[0], address: "", notes: "" }); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" />Nova Entrega
          </Button>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-1.5 mb-3 flex-wrap">
        <button onClick={() => setFilterStatus("todos")} className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${filterStatus === "todos" ? "bg-card border-foreground/20 shadow-sm" : "border-transparent text-muted-foreground"}`}>Todos ({totalDeliveries})</button>
        {DELIVERY_STATUS.map((s) => (
          <button key={s.value} onClick={() => setFilterStatus(s.value)} className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${filterStatus === s.value ? "bg-card border-foreground/20 shadow-sm" : "border-transparent text-muted-foreground"}`}>
            {s.label} ({counts[s.value] ?? 0})
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border rounded-xl p-10 text-center text-muted-foreground">
          <Truck className="w-10 h-10 mx-auto mb-3 opacity-25" />
          <p className="text-sm">Nenhuma entrega encontrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((d) => {
            const si = deliveryStatusInfo(d.status);
            const nextStatus: Record<string, string> = { pendente: "em_rota", em_rota: "entregue" };
            const nextLabel: Record<string, string> = { pendente: "Sair para Entrega", em_rota: "Marcar Entregue" };
            return (
              <div key={d.id} className="bg-card border rounded-xl px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${si.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <p className="font-medium text-sm">{d.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {d.clientName && <span className="text-xs text-muted-foreground">{d.clientName}</span>}
                          {d.employeeName && <span className="text-xs text-muted-foreground">· {d.employeeName}</span>}
                          {d.deliveryDate && <span className="text-xs text-muted-foreground">· {new Date(d.deliveryDate + "T12:00:00").toLocaleDateString("pt-BR")}</span>}
                          {d.address && <span className="text-xs text-muted-foreground truncate max-w-[120px]">· {d.address}</span>}
                        </div>
                        <span className={`inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${si.color}`}>{si.label}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {nextStatus[d.status] && (
                          <button onClick={() => updateStatus.mutate({ id: d.id, status: nextStatus[d.status] })}
                            className="text-xs bg-primary text-white px-2.5 py-1 rounded-lg font-medium">
                            {nextLabel[d.status]}
                          </button>
                        )}
                        {d.status === "em_rota" && (
                          <button onClick={() => updateStatus.mutate({ id: d.id, status: "problema" })}
                            className="text-xs bg-destructive/10 text-destructive px-2.5 py-1 rounded-lg font-medium">Problema</button>
                        )}
                        <button onClick={() => remove.mutate(d.id)} className="p-1.5 hover:bg-destructive/10 rounded-lg">
                          <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Entrega</DialogTitle><DialogDescription>Registre uma entrega ou serviço externo.</DialogDescription></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((d) => create.mutate(d))} className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem><FormLabel>Título</FormLabel><FormControl><Input {...field} placeholder="Ex: Pedido #123" /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="clientName" render={({ field }) => (
                  <FormItem><FormLabel>Cliente</FormLabel><FormControl><Input {...field} placeholder="Nome do cliente" /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="deliveryDate" render={({ field }) => (
                  <FormItem><FormLabel>Data Entrega</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="employeeId" render={({ field }) => (
                <FormItem><FormLabel>Entregador</FormLabel>
                  <select value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background">
                    <option value="">Nenhum</option>
                    {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </FormItem>
              )} />
              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem><FormLabel>Endereço</FormLabel><FormControl><Input {...field} placeholder="Rua, número, bairro" /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Observações</FormLabel><FormControl><Textarea {...field} rows={2} /></FormControl></FormItem>
              )} />
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={create.isPending}>Cadastrar</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// COMISSÕES TAB
// ─────────────────────────────────────────────────────────────────
type CommSale = {
  id: number; createdAt: string; total: number; commissionPct: number;
  commissionAmount: number; commissionPaid: boolean; commissionPaidAt: string | null;
  clientName: string | null; items: { name: string; quantity: number }[];
  source?: "venda" | "orcamento";
  paymentType?: string;
};
type CommSummary = {
  employee: { id: number; name: string; role: string; commissionRate: number; commissionPeriod: string; commissionLimit: number | null };
  period: { label: string; start: string; end: string };
  totalSalesAmount: number; totalSalesCount: number;
  grossCommission: number; paidCommission: number; pendingCommission: number;
  releasedCommission: number;
  blockedCommission: number;
  limitReached: boolean; limitPct: number | null;
  sales: CommSale[];
};
type PartialPayment = {
  id: number; employeeId: number; amount: string; paidAt: string; notes: string | null; referenceMonth: string | null; createdAt: string;
};
type MonthlyEarning = { employeeId: number; month: string; total: number; count: number };

function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmtMonth(m: string) {
  const [y, mo] = m.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(mo) - 1]} ${y}`;
}

function ComissoesTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [showMonthly, setShowMonthly] = useState(false);

  // Partial payment dialog state
  const [partialDialog, setPartialDialog] = useState<{ open: boolean; employeeId: number; employeeName: string; currentMonth: string } | null>(null);
  const [partialForm, setPartialForm] = useState({ amount: "", paidAt: todayISO(), notes: "" });

  const { data: summaries = [], isLoading } = useQuery<CommSummary[]>({
    queryKey: ["commissions-summary"],
    queryFn: () => fetch("/api/commissions/summary").then((r) => r.json()),
    refetchInterval: 30_000,
  });

  const { data: partialPayments = [] } = useQuery<PartialPayment[]>({
    queryKey: ["commissions-partial-payments"],
    queryFn: () => fetch("/api/commissions/partial-payments").then((r) => r.json()),
    refetchInterval: 30_000,
  });

  const { data: monthlyEarnings = [] } = useQuery<MonthlyEarning[]>({
    queryKey: ["commissions-monthly-earnings"],
    queryFn: () => fetch("/api/commissions/monthly-earnings").then((r) => r.json()),
    enabled: showMonthly,
  });

  const payAll = useMutation({
    mutationFn: ({ saleIds }: { saleIds: number[] }) =>
      fetch("/api/commissions/pay", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ saleIds }) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["commissions-summary"] }); toast({ title: "Comissão marcada como paga!" }); },
  });

  const unpaySale = useMutation({
    mutationFn: ({ saleIds }: { saleIds: number[] }) =>
      fetch("/api/commissions/unpay", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ saleIds }) }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["commissions-summary"] }); toast({ title: "Revertido" }); },
  });

  const addPartialPay = useMutation({
    mutationFn: (data: { employeeId: number; amount: number; paidAt: string; notes?: string; referenceMonth?: string }) =>
      fetch("/api/commissions/partial-payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commissions-partial-payments"] });
      qc.invalidateQueries({ queryKey: ["commissions-monthly-earnings"] });
      toast({ title: "Pagamento registrado!" });
      setPartialDialog(null);
      setPartialForm({ amount: "", paidAt: todayISO(), notes: "" });
    },
    onError: () => toast({ title: "Erro ao registrar pagamento", variant: "destructive" }),
  });

  const deletePartialPay = useMutation({
    mutationFn: (id: number) => fetch(`/api/commissions/partial-payments/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commissions-partial-payments"] });
      qc.invalidateQueries({ queryKey: ["commissions-monthly-earnings"] });
      toast({ title: "Pagamento removido" });
    },
  });

  if (isLoading) return (
    <div className="space-y-3">
      {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
    </div>
  );

  const withSales = summaries.filter((s) => s.totalSalesCount > 0);
  const noSales = summaries.filter((s) => s.totalSalesCount === 0);

  if (summaries.length === 0) return (
    <div className="bg-card border rounded-xl p-10 text-center text-muted-foreground">
      <Award className="w-10 h-10 mx-auto mb-3 opacity-25" />
      <p className="text-sm font-medium">Nenhum funcionário cadastrado</p>
      <p className="text-xs mt-1">Cadastre funcionários na aba Vendedores para gerenciar comissões.</p>
    </div>
  );

  const totalReleased = summaries.reduce((a, s) => a + (s.releasedCommission ?? 0), 0);
  const totalBlocked = summaries.reduce((a, s) => a + (s.blockedCommission ?? 0), 0);
  const totalPaid = summaries.reduce((a, s) => a + s.paidCommission, 0);

  // Partial payments grouped by employee + month
  function getPartialForEmployee(empId: number, month: string) {
    return partialPayments.filter((p) => p.employeeId === empId && (p.referenceMonth ?? p.paidAt.slice(0, 7)) === month);
  }

  return (
    <div className="space-y-4">
      {/* Global summary bar */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-center">
          <p className="text-[10px] text-primary uppercase font-semibold tracking-wide mb-0.5">Liberada</p>
          <p className="text-base font-bold text-primary">{formatCurrency(totalReleased)}</p>
          <p className="text-[10px] text-muted-foreground">à vista</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
          <p className="text-[10px] text-amber-700 uppercase font-semibold tracking-wide mb-0.5">Bloqueada</p>
          <p className="text-base font-bold text-amber-700">{formatCurrency(totalBlocked)}</p>
          <p className="text-[10px] text-muted-foreground">aguard. pgto</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
          <p className="text-[10px] text-emerald-700 uppercase font-semibold tracking-wide mb-0.5">Já Pago</p>
          <p className="text-base font-bold text-emerald-700">{formatCurrency(totalPaid)}</p>
          <p className="text-[10px] text-muted-foreground">ao vendedor</p>
        </div>
      </div>

      {/* Employees with sales */}
      {withSales.map((s) => {
        const isOpen = !!expanded[s.employee.id];
        const releasedSaleIds = s.sales
          .filter((sale) => !sale.commissionPaid && sale.source !== "orcamento" && sale.paymentType === "avista")
          .map((sale) => sale.id);
        const released = s.releasedCommission ?? 0;
        const blocked = s.blockedCommission ?? 0;

        // Current period month for partial payments
        const periodMonth = s.period.start.slice(0, 7);
        const periodPartials = getPartialForEmployee(s.employee.id, periodMonth);
        const totalPartialPaid = periodPartials.reduce((a, p) => a + Number(p.amount), 0);
        const commBalance = s.grossCommission - totalPartialPaid;

        return (
          <div key={s.employee.id} className="bg-card border rounded-xl shadow-sm overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b bg-muted/20">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                    {s.employee.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold">{s.employee.name}</p>
                    <p className="text-xs text-muted-foreground">{s.employee.role}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Período: <span className="font-medium text-foreground">{s.period.label}</span>
                    </p>
                  </div>
                </div>
                {released > 0 ? (
                  <Button size="sm" onClick={() => payAll.mutate({ saleIds: releasedSaleIds })} disabled={payAll.isPending}
                    className="shrink-0 text-xs h-8">
                    <CheckCheck className="w-3.5 h-3.5 mr-1" />Pagar {formatCurrency(released)}
                  </Button>
                ) : blocked > 0 ? (
                  <span className="flex items-center gap-1 text-xs text-amber-700 font-semibold shrink-0 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                    <AlertTriangle className="w-3.5 h-3.5" />Bloqueada
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold shrink-0 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" />Em Dia
                  </span>
                )}
              </div>

              {/* Stats row — 4 cols */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                <div className="bg-card border rounded-lg p-2 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase mb-0.5">Vendas</p>
                  <p className="text-sm font-bold text-primary">{formatCurrency(s.totalSalesAmount)}</p>
                  <p className="text-[10px] text-muted-foreground">{s.totalSalesCount} item{s.totalSalesCount !== 1 ? "s" : ""}</p>
                </div>
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-primary uppercase mb-0.5">Liberada</p>
                  <p className="text-sm font-bold text-primary">{formatCurrency(released)}</p>
                  <p className="text-[10px] text-muted-foreground">à vista</p>
                </div>
                <div className={`border rounded-lg p-2 text-center ${blocked > 0 ? "bg-amber-50 border-amber-200" : "bg-muted/20"}`}>
                  <p className="text-[10px] text-muted-foreground uppercase mb-0.5">Bloqueada</p>
                  <p className={`text-sm font-bold ${blocked > 0 ? "text-amber-600" : "text-muted-foreground"}`}>{formatCurrency(blocked)}</p>
                  <p className="text-[10px] text-muted-foreground">a prazo</p>
                </div>
                <div className={`border rounded-lg p-2 text-center ${s.paidCommission > 0 ? "bg-emerald-50 border-emerald-200" : "bg-muted/20"}`}>
                  <p className="text-[10px] text-muted-foreground uppercase mb-0.5">Pago</p>
                  <p className={`text-sm font-bold ${s.paidCommission > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>{formatCurrency(s.paidCommission)}</p>
                  <p className="text-[10px] text-muted-foreground">ao vendedor</p>
                </div>
              </div>

              {/* Limit progress bar */}
              {s.employee.commissionLimit != null && (
                <div className="mb-3">
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-muted-foreground">Teto de comissão</span>
                    <span className={`font-semibold ${s.limitReached ? "text-destructive" : "text-muted-foreground"}`}>
                      {formatCurrency(s.grossCommission)} / {formatCurrency(s.employee.commissionLimit)}
                      {s.limitReached && " · TETO ATINGIDO"}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className={`h-2 rounded-full transition-all ${s.limitReached ? "bg-destructive" : "bg-primary"}`}
                      style={{ width: `${Math.min(100, s.limitPct ?? 0)}%` }} />
                  </div>
                </div>
              )}

              {/* ── Pagamentos Parciais ── */}
              <div className="border border-dashed border-primary/30 rounded-xl p-3 bg-primary/[0.03]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-primary" />
                    Pagamentos Parciais ao Funcionário
                  </p>
                  <Button size="sm" variant="outline" className="h-7 text-xs px-2.5 border-primary/40 text-primary hover:bg-primary/5"
                    onClick={() => {
                      setPartialDialog({ open: true, employeeId: s.employee.id, employeeName: s.employee.name, currentMonth: periodMonth });
                      setPartialForm({ amount: "", paidAt: todayISO(), notes: "" });
                    }}>
                    <Plus className="w-3 h-3 mr-1" />Pagar Parcial
                  </Button>
                </div>

                {/* Balance summary */}
                <div className="grid grid-cols-3 gap-1.5 mb-2">
                  <div className="bg-card border rounded-lg p-1.5 text-center">
                    <p className="text-[9px] text-muted-foreground uppercase">Comissão Total</p>
                    <p className="text-xs font-bold">{formatCurrency(s.grossCommission)}</p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-1.5 text-center">
                    <p className="text-[9px] text-emerald-700 uppercase">Pago em Partes</p>
                    <p className="text-xs font-bold text-emerald-700">{formatCurrency(totalPartialPaid)}</p>
                  </div>
                  <div className={`border rounded-lg p-1.5 text-center ${commBalance > 0 ? "bg-orange-50 border-orange-200" : "bg-emerald-50 border-emerald-200"}`}>
                    <p className={`text-[9px] uppercase ${commBalance > 0 ? "text-orange-700" : "text-emerald-700"}`}>Saldo Devedor</p>
                    <p className={`text-xs font-bold ${commBalance > 0 ? "text-orange-700" : "text-emerald-600"}`}>{formatCurrency(Math.max(0, commBalance))}</p>
                  </div>
                </div>

                {/* Payments list */}
                {periodPartials.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground text-center py-1">Nenhum pagamento parcial registrado neste período.</p>
                ) : (
                  <div className="space-y-1">
                    {periodPartials.map((p) => (
                      <div key={p.id} className="flex items-center gap-2 bg-card border border-emerald-100 rounded-lg px-2.5 py-1.5 text-xs">
                        <span className="text-emerald-600 font-bold shrink-0">{formatCurrency(Number(p.amount))}</span>
                        <span className="text-muted-foreground shrink-0">
                          {new Date(p.paidAt + "T12:00:00").toLocaleDateString("pt-BR")}
                        </span>
                        {p.notes && <span className="text-muted-foreground flex-1 truncate italic">{p.notes}</span>}
                        {!p.notes && <span className="flex-1" />}
                        <button onClick={() => deletePartialPay.mutate(p.id)}
                          className="shrink-0 text-muted-foreground hover:text-destructive transition-colors p-0.5 rounded">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sales list toggle */}
            <button
              onClick={() => setExpanded((prev) => ({ ...prev, [s.employee.id]: !isOpen }))}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-muted-foreground hover:bg-muted/30 transition-colors"
            >
              <span>{s.sales.length} venda{s.sales.length !== 1 ? "s" : ""} no período</span>
              {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {/* Individual sales */}
            {isOpen && (
              <div className="px-3 pb-3 space-y-1.5 max-h-72 overflow-y-auto">
                {s.sales.map((sale) => {
                  const isAprazo = sale.paymentType === "aprazo";
                  const isBlocked = !sale.commissionPaid && isAprazo;
                  const isReleased = !sale.commissionPaid && !isAprazo && sale.source !== "orcamento";
                  return (
                    <div key={`${sale.source ?? "venda"}-${sale.id}`}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs border
                        ${sale.commissionPaid ? "bg-emerald-50/50 border-emerald-100"
                          : isBlocked ? "bg-amber-50/50 border-amber-100"
                          : "bg-muted/30 border-transparent"}`}>
                      {sale.source === "orcamento"
                        ? <FileText className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                        : <ShoppingBag className={`w-3.5 h-3.5 shrink-0 ${sale.commissionPaid ? "text-emerald-500" : isBlocked ? "text-amber-500" : "text-muted-foreground"}`} />
                      }
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate flex items-center gap-1">
                          {sale.source === "orcamento" && <span className="text-[10px] bg-blue-100 text-blue-600 px-1 py-0 rounded font-bold shrink-0">Orç.</span>}
                          {isAprazo && !sale.commissionPaid && <span className="text-[10px] bg-amber-100 text-amber-700 px-1 py-0 rounded font-bold shrink-0">🔒 A Prazo</span>}
                          {!isAprazo && sale.source !== "orcamento" && !sale.commissionPaid && <span className="text-[10px] bg-primary/10 text-primary px-1 py-0 rounded font-bold shrink-0">✓ À Vista</span>}
                          {sale.items.map((i) => `${i.name} (${i.quantity}x)`).join(", ") || (sale.source === "orcamento" ? "Orçamento convertido" : "Venda")}
                        </p>
                        {sale.clientName && <p className="text-muted-foreground truncate">Cliente: {sale.clientName}</p>}
                        <p className="text-muted-foreground">{new Date(sale.createdAt).toLocaleDateString("pt-BR")}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-primary">{formatCurrency(sale.total)}</p>
                        <p className={`font-semibold text-[10px] ${sale.commissionPaid ? "text-emerald-600" : isBlocked ? "text-amber-600" : "text-foreground"}`}>
                          com. {formatCurrency(sale.commissionAmount)}
                          {isBlocked && " 🔒"}
                          {sale.commissionPaid && " ✓"}
                        </p>
                      </div>
                      {sale.source !== "orcamento" && (
                        sale.commissionPaid ? (
                          <button onClick={() => unpaySale.mutate({ saleIds: [sale.id] })}
                            className="ml-1 text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium shrink-0">
                            ✓ Pago
                          </button>
                        ) : isReleased ? (
                          <button onClick={() => payAll.mutate({ saleIds: [sale.id] })}
                            className="ml-1 text-[10px] bg-primary text-white px-1.5 py-0.5 rounded font-medium shrink-0 hover:bg-primary/80">
                            Pagar
                          </button>
                        ) : (
                          <span className="ml-1 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium shrink-0 cursor-default">
                            Bloqueada
                          </span>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {isOpen && releasedSaleIds.length > 0 && (
              <div className="px-3 pb-3">
                <Button size="sm" className="w-full text-xs h-8"
                  onClick={() => payAll.mutate({ saleIds: releasedSaleIds })} disabled={payAll.isPending}>
                  <CheckCheck className="w-3.5 h-3.5 mr-1" />
                  Pagar todas ({releasedSaleIds.length}) — {formatCurrency(released)}
                </Button>
              </div>
            )}
          </div>
        );
      })}

      {/* Employees without sales */}
      {noSales.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2 px-1">Sem vendas no período</p>
          <div className="space-y-2">
            {noSales.map((s) => {
              const periodMonth = s.period.start.slice(0, 7);
              const periodPartials = getPartialForEmployee(s.employee.id, periodMonth);
              const totalPartialPaid = periodPartials.reduce((a, p) => a + Number(p.amount), 0);
              return (
                <div key={s.employee.id} className="bg-card border rounded-xl px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center font-bold text-sm text-muted-foreground shrink-0">
                        {s.employee.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{s.employee.name}</p>
                        <p className="text-xs text-muted-foreground">{s.employee.role} · {s.employee.commissionRate}%</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {totalPartialPaid > 0 && (
                        <span className="text-xs text-emerald-600 font-semibold">{formatCurrency(totalPartialPaid)} pago</span>
                      )}
                      <Button size="sm" variant="outline" className="h-7 text-xs px-2 border-primary/40 text-primary hover:bg-primary/5"
                        onClick={() => {
                          setPartialDialog({ open: true, employeeId: s.employee.id, employeeName: s.employee.name, currentMonth: periodMonth });
                          setPartialForm({ amount: "", paidAt: todayISO(), notes: "" });
                        }}>
                        <Plus className="w-3 h-3 mr-1" />Pagar Parcial
                      </Button>
                    </div>
                  </div>
                  {periodPartials.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {periodPartials.map((p) => (
                        <div key={p.id} className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1 text-xs">
                          <span className="text-emerald-600 font-bold">{formatCurrency(Number(p.amount))}</span>
                          <span className="text-muted-foreground">{new Date(p.paidAt + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                          {p.notes && <span className="text-muted-foreground italic flex-1 truncate">{p.notes}</span>}
                          {!p.notes && <span className="flex-1" />}
                          <button onClick={() => deletePartialPay.mutate(p.id)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Ganhos por Mês ── */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <button onClick={() => setShowMonthly((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-muted/30 transition-colors">
          <span className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" />Histórico de Ganhos por Mês</span>
          {showMonthly ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        {showMonthly && (
          <div className="border-t">
            {monthlyEarnings.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Nenhum pagamento registrado ainda.</p>
            ) : (
              <div className="divide-y">
                {monthlyEarnings.map((e) => {
                  const emp = summaries.find((s) => s.employee.id === e.employeeId);
                  const empName = emp?.employee.name ?? `Funcionário #${e.employeeId}`;
                  return (
                    <div key={`${e.employeeId}-${e.month}`} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                          {empName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{empName}</p>
                          <p className="text-xs text-muted-foreground">{fmtMonth(e.month)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-emerald-600">{formatCurrency(e.total)}</p>
                        <p className="text-[10px] text-muted-foreground">{e.count} pagamento{e.count !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Dialog: Pagar Parcial ── */}
      <Dialog open={!!partialDialog?.open} onOpenChange={(o) => { if (!o) setPartialDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Pagar Parcial — {partialDialog?.employeeName}</DialogTitle>
            <DialogDescription>Registre um pagamento parcial da comissão. O saldo restante será atualizado automaticamente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5 font-medium">Valor pago (R$) *</label>
              <Input
                type="number" min="0.01" step="0.01" placeholder="0,00"
                value={partialForm.amount}
                onChange={(e) => setPartialForm((f) => ({ ...f, amount: e.target.value }))}
                className="text-base"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5 font-medium">Data do pagamento *</label>
              <Input
                type="date"
                value={partialForm.paidAt}
                onChange={(e) => setPartialForm((f) => ({ ...f, paidAt: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5 font-medium">Observação (opcional)</label>
              <Input
                placeholder="Ex: adiantamento, 1ª parcela..."
                value={partialForm.notes}
                onChange={(e) => setPartialForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPartialDialog(null)}>Cancelar</Button>
            <Button
              disabled={!partialForm.amount || Number(partialForm.amount) <= 0 || addPartialPay.isPending}
              onClick={() => {
                if (!partialDialog) return;
                addPartialPay.mutate({
                  employeeId: partialDialog.employeeId,
                  amount: Number(partialForm.amount),
                  paidAt: partialForm.paidAt,
                  notes: partialForm.notes || undefined,
                  referenceMonth: partialForm.paidAt.slice(0, 7),
                });
              }}>
              {addPartialPay.isPending ? "Salvando..." : "Registrar Pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────
export default function Equipe() {
  const [tab, setTab] = useState<Tab>("vendedores");
  const qc = useQueryClient();
  const { confirm: askConfirm, ConfirmDialog } = useConfirm();

  const { data: employees = [], isLoading: empLoading } = useQuery<Employee[]>({
    queryKey: ["employees"],
    queryFn: () => fetch("/api/employees").then((r) => r.json()),
  });

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "vendedores", label: "Vendedores", icon: Users },
    { key: "comissoes",  label: "Comissões",  icon: DollarSign },
    { key: "horarios",   label: "Horários",   icon: Calendar },
    { key: "entregas",   label: "Entregas",   icon: Truck },
  ];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto animate-fade-in">
      {ConfirmDialog}
      <div className="mb-5">
        <h1 className="text-xl md:text-2xl font-bold">Equipe</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Vendedores, comissões, horários e entregas</p>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 gap-1 bg-muted rounded-xl p-1 mb-5">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all ${tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>

      {tab === "vendedores" && <VendedoresTab employees={employees} isLoading={empLoading} onRefresh={() => { qc.invalidateQueries({ queryKey: ["employees"] }); }} />}
      {tab === "comissoes"  && <ComissoesTab />}
      {tab === "horarios"   && <HorariosTab employees={employees} isLoading={empLoading} />}
      {tab === "entregas"   && <EntregasTab employees={employees} />}
    </div>
  );
}
