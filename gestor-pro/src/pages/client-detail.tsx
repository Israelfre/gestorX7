import { useParams, useLocation } from "wouter";
import { useGetClientHistory, getGetClientHistoryQueryKey } from "@workspace/api-client-react";
import { ArrowLeft, Phone, AlertTriangle, DollarSign, Calendar, FileText, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";

export default function ClientDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const id = Number(params.id);

  const { data, isLoading } = useGetClientHistory(id, {
    query: { enabled: !!id, queryKey: getGetClientHistoryQueryKey(id) },
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Cliente nao encontrado
      </div>
    );
  }

  const { client, transactions, tasks, quotes } = data;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button
        onClick={() => setLocation("/clientes")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        data-testid="button-back-clients"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar aos Clientes
      </button>

      {/* Client Card */}
      <div className="bg-card border rounded-lg p-5 mb-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{client.name}</h1>
            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
              <Phone className="w-4 h-4" />
              {client.phone}
            </div>
            {(client.logradouro || client.cidade) && (
              <div className="flex items-start gap-1 text-sm text-muted-foreground mt-1">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  {[
                    client.logradouro && client.numero
                      ? `${client.logradouro}, ${client.numero}`
                      : client.logradouro,
                    client.complemento,
                    client.bairro,
                    client.cidade && client.estado
                      ? `${client.cidade} / ${client.estado}`
                      : client.cidade || client.estado,
                    client.cep,
                  ].filter(Boolean).join(" · ")}
                </span>
              </div>
            )}
            {client.notes && <p className="text-sm text-muted-foreground mt-2">{client.notes}</p>}
          </div>
          {client.isDebtor && (
            <div className="flex flex-col items-end">
              <span className="flex items-center gap-1 text-sm bg-primary/10 text-primary px-3 py-1 rounded-full font-medium">
                <AlertTriangle className="w-4 h-4" /> Devedor
              </span>
              <p className="text-primary font-bold mt-1">{formatCurrency(client.debtAmount)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Transactions */}
      <div className="bg-card border rounded-lg shadow-sm mb-4">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">Movimentacoes Financeiras</h2>
          <span className="ml-auto text-xs text-muted-foreground">{transactions.length} registros</span>
        </div>
        <div className="divide-y">
          {transactions.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground text-center">Nenhuma movimentacao</p>
          ) : (
            transactions.map((t) => (
              <div key={t.id} data-testid={`transaction-${t.id}`} className="px-5 py-3 flex items-center gap-4">
                <div className={`w-2 h-2 rounded-full shrink-0 ${t.type === "income" ? "bg-green-500" : "bg-primary"}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium">{t.description}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(t.createdAt)}</p>
                </div>
                <p className={`font-semibold text-sm ${t.type === "income" ? "text-green-600" : "text-primary"}`}>
                  {t.type === "income" ? "+" : "-"}{formatCurrency(t.amount)}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Tasks */}
      <div className="bg-card border rounded-lg shadow-sm mb-4">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">Tarefas</h2>
          <span className="ml-auto text-xs text-muted-foreground">{tasks.length} registros</span>
        </div>
        <div className="divide-y">
          {tasks.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground text-center">Nenhuma tarefa</p>
          ) : (
            tasks.map((t) => (
              <div key={t.id} data-testid={`client-task-${t.id}`} className="px-5 py-3 flex items-center gap-4">
                <div className={`w-2 h-2 rounded-full shrink-0 ${
                  t.status === "completed" ? "bg-green-500" : t.isOverdue ? "bg-primary" : "bg-amber-400"
                }`} />
                <div className="flex-1">
                  <p className={`text-sm font-medium ${t.isOverdue ? "text-primary" : ""}`}>{t.title}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(t.dueDate)}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  t.status === "completed"
                    ? "bg-green-100 text-green-700"
                    : t.isOverdue
                    ? "bg-primary/10 text-primary"
                    : "bg-amber-100 text-amber-700"
                }`}>
                  {t.status === "completed" ? "Concluido" : t.isOverdue ? "Atrasado" : "Pendente"}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quotes */}
      <div className="bg-card border rounded-lg shadow-sm">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <h2 className="font-semibold">Orçamentos</h2>
          <span className="ml-auto text-xs text-muted-foreground">{quotes.length} registros</span>
        </div>
        <div className="divide-y">
          {quotes.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground text-center">Nenhum orçamento</p>
          ) : (
            quotes.map((q) => (
              <div key={q.id} data-testid={`client-quote-${q.id}`} className="px-5 py-3 flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium">{q.description}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(q.createdAt)}</p>
                </div>
                <p className="font-semibold text-sm">{formatCurrency(q.amount)}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  q.status === "converted"
                    ? "bg-green-100 text-green-700"
                    : q.status === "rejected"
                    ? "bg-primary/10 text-primary"
                    : "bg-amber-100 text-amber-700"
                }`}>
                  {q.status === "converted" ? "Convertido" : q.status === "rejected" ? "Recusado" : "Pendente"}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
