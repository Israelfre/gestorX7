import { useState } from "react";
import { useConfirm } from "@/hooks/use-confirm";
import {
  useListTasks, useCreateTask, useUpdateTask, useDeleteTask, useListClients, getListTasksQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, CheckCircle2, Circle, Trash2, AlertTriangle, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { VoiceButton } from "@/components/VoiceButton";
import { formatDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";

const taskSchema = z.object({
  title: z.string().min(1, "Titulo obrigatorio"),
  clientId: z.number().optional(),
  dueDate: z.string().min(1, "Data obrigatoria"),
  status: z.enum(["pending", "completed"]).default("pending"),
});

type TaskForm = z.infer<typeof taskSchema>;
type Filter = "all" | "pending" | "completed" | "overdue";

function interpretarTarefa(texto: string): Partial<TaskForm> {
  const t = texto.toLowerCase();
  const today = new Date();

  let dueDate = today.toISOString().split("T")[0];

  if (t.includes("amanhã") || t.includes("amanha")) {
    const d = new Date(today); d.setDate(d.getDate() + 1);
    dueDate = d.toISOString().split("T")[0];
  } else if (t.includes("hoje")) {
    dueDate = today.toISOString().split("T")[0];
  } else {
    // "dia 25", "dia 3 de maio", "25/05", "25/05/2025"
    const diaMatch = t.match(/dia\s+(\d{1,2})(?:\s+de\s+(\w+))?/);
    const slashMatch = t.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
    if (diaMatch) {
      const day = parseInt(diaMatch[1]);
      const MESES: Record<string, number> = { janeiro:0, fevereiro:1, março:2, marco:2, abril:3, maio:4, junho:5, julho:6, agosto:7, setembro:8, outubro:9, novembro:10, dezembro:11 };
      const monthName = diaMatch[2]?.toLowerCase();
      const month = monthName && MESES[monthName] !== undefined ? MESES[monthName] : today.getMonth();
      const year = today.getFullYear();
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) dueDate = d.toISOString().split("T")[0];
    } else if (slashMatch) {
      const day = parseInt(slashMatch[1]), mon = parseInt(slashMatch[2]) - 1;
      const year = slashMatch[3] ? (slashMatch[3].length === 2 ? 2000 + parseInt(slashMatch[3]) : parseInt(slashMatch[3])) : today.getFullYear();
      const d = new Date(year, mon, day);
      if (!isNaN(d.getTime())) dueDate = d.toISOString().split("T")[0];
    }
  }

  let title = texto
    .replace(/(?:amanhã|amanha|hoje)/gi, "")
    .replace(/dia\s+\d{1,2}(?:\s+de\s+\w+)?/gi, "")
    .replace(/\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/g, "")
    .replace(/\s{2,}/g, " ").trim();

  title = title ? title.charAt(0).toUpperCase() + title.slice(1) : "";

  return { title, dueDate };
}

export default function Agenda() {
  const { confirm: askConfirm, ConfirmDialog } = useConfirm();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: tasks = [], isLoading } = useListTasks();
  const { data: clients = [] } = useListClients();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const todayStr = new Date().toISOString().split("T")[0];

  const form = useForm<TaskForm>({
    resolver: zodResolver(taskSchema),
    defaultValues: { title: "", dueDate: todayStr, status: "pending" },
  });

  const openCreate = (prefill?: Partial<TaskForm>) => {
    form.reset({ title: "", dueDate: todayStr, status: "pending", ...prefill });
    setDialogOpen(true);
  };

  const onSubmit = (data: TaskForm) => {
    createTask.mutate({ data: { title: data.title, clientId: data.clientId, dueDate: data.dueDate, status: data.status } }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListTasksQueryKey() }); setDialogOpen(false); form.reset({ title: "", dueDate: todayStr, status: "pending" }); toast({ title: "Tarefa criada" }); },
    });
  };

  const toggleStatus = (id: number, current: string) => {
    updateTask.mutate({ id, data: { status: current === "completed" ? "pending" : "completed" } }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListTasksQueryKey() }),
    });
  };

  const handleDelete = async (id: number) => {
    if (!await askConfirm({ title: "Excluir tarefa", description: "Tem certeza que deseja excluir esta tarefa?", confirmText: "Excluir", variant: "destructive" })) return;
    deleteTask.mutate({ id }, { onSuccess: () => { qc.invalidateQueries({ queryKey: getListTasksQueryKey() }); toast({ title: "Tarefa removida" }); } });
  };

  const typedTasks = tasks as any[];
  const overdueCount = typedTasks.filter((t) => t.isOverdue).length;
  const filteredTasks = typedTasks.filter((t) => {
    if (filter === "all") return true;
    if (filter === "overdue") return t.isOverdue;
    return t.status === filter;
  });

  const filterLabels: Record<Filter, string> = {
    all: "Todas",
    pending: "Pendentes",
    overdue: overdueCount > 0 ? `Atrasadas (${overdueCount})` : "Atrasadas",
    completed: "Concluídas",
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto animate-fade-in">
      {ConfirmDialog}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Agenda</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {typedTasks.filter((t) => t.status === "pending").length} pendentes
            {overdueCount > 0 && <span className="text-primary font-medium"> · {overdueCount} atrasadas</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <VoiceButton onTranscript={(t) => openCreate(interpretarTarefa(t))} />
          <Button onClick={() => openCreate()} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Nova Tarefa</span>
            <span className="sm:hidden">Nova</span>
          </Button>
        </div>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
        {(["all", "pending", "overdue", "completed"] as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs sm:text-sm rounded-full font-medium transition-all whitespace-nowrap shrink-0 ${
              filter === f ? "bg-primary text-white shadow-sm" : "bg-card border text-muted-foreground hover:text-foreground"
            }`}>
            {filterLabels[f]}
          </button>
        ))}
      </div>

      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-25" />
            <p className="text-sm">Nenhuma tarefa nesta categoria</p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredTasks.map((task) => (
              <div key={task.id}
                className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${task.isOverdue ? "bg-primary/4 hover:bg-primary/8" : "hover:bg-muted/20"}`}>
                <button onClick={() => toggleStatus(task.id, task.status)} className="shrink-0 active:scale-90 transition-transform">
                  {task.status === "completed" ? (
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  ) : task.isOverdue ? (
                    <AlertTriangle className="w-5 h-5 text-destructive animate-pulse" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${task.status === "completed" ? "line-through text-muted-foreground" : task.isOverdue ? "text-destructive" : ""}`}>
                    {task.title}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 flex-wrap">
                    <Calendar className="w-3 h-3" />
                    <span>{formatDate(task.dueDate)}</span>
                    {task.clientName && <><span>·</span><span className="truncate max-w-[120px]">{task.clientName}</span></>}
                    {task.isOverdue && <span className="text-destructive font-semibold">ATRASADO</span>}
                  </div>
                </div>
                <button onClick={() => handleDelete(task.id)} className="p-2 hover:bg-destructive/10 rounded-lg transition-colors active:scale-95 shrink-0">
                  <Trash2 className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle><DialogDescription>Adicione um compromisso ou tarefa à sua agenda.</DialogDescription></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem><FormLabel>Título</FormLabel><FormControl><Input {...field} placeholder="Ex: Visita técnica" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="dueDate" render={({ field }) => (
                <FormItem><FormLabel>Data</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="clientId" render={({ field }) => (
                <FormItem><FormLabel>Cliente (opcional)</FormLabel>
                  <Select onValueChange={(v) => field.onChange(v === "none" ? undefined : parseInt(v))} defaultValue="none">
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {(clients as any[]).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1 sm:flex-none">Cancelar</Button>
                <Button type="submit" disabled={createTask.isPending} className="flex-1 sm:flex-none">Criar Tarefa</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
