import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, clientsTable, transactionsTable, tasksTable, inventoryTable, quotesTable } from "@workspace/db";
import { getTenantId } from "../middleware/auth";

const router = Router();

router.get("/dashboard/summary", async (req, res) => {
  const tid = getTenantId(req);
  const today = new Date().toISOString().split("T")[0];

  const [clients, transactions, tasks, inventory, quotes] = await Promise.all([
    db.select().from(clientsTable).where(eq(clientsTable.tenantId, tid)),
    db.select().from(transactionsTable).where(eq(transactionsTable.tenantId, tid)),
    db.select().from(tasksTable).where(eq(tasksTable.tenantId, tid)),
    db.select().from(inventoryTable).where(eq(inventoryTable.tenantId, tid)),
    db.select().from(quotesTable).where(eq(quotesTable.tenantId, tid)),
  ]);

  let totalIncome = 0, totalExpenses = 0;
  for (const t of transactions) {
    const amount = Number(t.amount);
    if (t.type === "income") totalIncome += amount;
    else totalExpenses += amount;
  }

  const totalReceivableToday = clients
    .filter((c) => c.isDebtor && Number(c.debtAmount) > 0 && c.debtDueDate && c.debtDueDate <= today)
    .reduce((sum, c) => sum + Number(c.debtAmount), 0);

  const totalDebtorClients = clients.filter((c) => c.isDebtor).length;
  const overdueDebtors = clients.filter((c) => c.isDebtor && c.debtDueDate && c.debtDueDate < today).length;
  const dueTodayDebtors = clients.filter((c) => c.isDebtor && c.debtDueDate === today).length;

  res.json({
    balance: totalIncome - totalExpenses,
    totalReceivable: totalReceivableToday,
    totalReceivableSub: overdueDebtors > 0
      ? `${overdueDebtors} atrasado${overdueDebtors > 1 ? "s" : ""}${dueTodayDebtors > 0 ? ` + ${dueTodayDebtors} hoje` : ""}`
      : dueTodayDebtors > 0 ? `${dueTodayDebtors} vence${dueTodayDebtors > 1 ? "m" : ""} hoje` : undefined,
    totalClients: clients.length,
    totalDebtorClients,
    todayTasksCount: tasks.filter((t) => t.dueDate === today && t.status === "pending").length,
    overdueTasksCount: tasks.filter((t) => t.status === "pending" && t.dueDate < today).length,
    lowStockItemsCount: inventory.filter((i) => i.quantity <= i.minQuantity).length,
    pendingQuotesCount: quotes.filter((q) => q.status === "pending").length,
  });
});

router.get("/dashboard/today-tasks", async (req, res) => {
  const tid = getTenantId(req);
  const today = new Date().toISOString().split("T")[0];
  const [tasks, allClients] = await Promise.all([
    db.select().from(tasksTable).where(and(eq(tasksTable.tenantId, tid), eq(tasksTable.dueDate, today))),
    db.select().from(clientsTable).where(eq(clientsTable.tenantId, tid)),
  ]);
  const allClientMap: Record<number, string> = {};
  allClients.forEach((c) => { allClientMap[c.id] = c.name; });
  res.json(tasks.map((t) => ({ ...t, clientName: t.clientId ? allClientMap[t.clientId] ?? null : null, isOverdue: t.status === "pending" && t.dueDate < today, createdAt: t.createdAt.toISOString() })));
});

router.get("/dashboard/today-collections", async (req, res) => {
  const tid = getTenantId(req);
  const today = new Date().toISOString().split("T")[0];
  const clients = await db.select().from(clientsTable).where(eq(clientsTable.tenantId, tid));
  const debtors = clients
    .filter((c) => c.isDebtor && Number(c.debtAmount) > 0)
    .map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone ?? null,
      debtAmount: Number(c.debtAmount),
      debtDueDate: c.debtDueDate ?? null,
      isOverdue: c.debtDueDate ? c.debtDueDate < today : false,
      isDueToday: c.debtDueDate === today,
    }))
    .sort((a, b) => {
      if (!a.debtDueDate) return 1;
      if (!b.debtDueDate) return -1;
      return a.debtDueDate.localeCompare(b.debtDueDate);
    });
  res.json(debtors);
});

router.get("/dashboard/alerts", async (req, res) => {
  const tid = getTenantId(req);
  const today = new Date().toISOString().split("T")[0];
  const alerts: Array<{ id: string; type: string; message: string; severity: string; relatedId?: number }> = [];

  const [clients, tasks, inventory] = await Promise.all([
    db.select().from(clientsTable).where(eq(clientsTable.tenantId, tid)),
    db.select().from(tasksTable).where(eq(tasksTable.tenantId, tid)),
    db.select().from(inventoryTable).where(eq(inventoryTable.tenantId, tid)),
  ]);

  for (const client of clients) {
    if (client.isDebtor) {
      const amount = `R$ ${Number(client.debtAmount).toFixed(2).replace(".", ",")}`;
      if (client.debtDueDate) {
        if (client.debtDueDate < today) {
          alerts.push({ id: `debtor-overdue-${client.id}`, type: "debtor_overdue", message: `Cobrança ATRASADA: ${client.name} — ${amount} (venceu ${client.debtDueDate})`, severity: "danger", relatedId: client.id });
        } else if (client.debtDueDate === today) {
          alerts.push({ id: `debtor-due-today-${client.id}`, type: "debtor_due_today", message: `Cobrar hoje: ${client.name} — ${amount}`, severity: "danger", relatedId: client.id });
        } else {
          const diff = Math.ceil((new Date(client.debtDueDate).getTime() - new Date(today).getTime()) / 86400000);
          if (diff <= 3) {
            alerts.push({ id: `debtor-soon-${client.id}`, type: "debtor_due_soon", message: `Cobrar em ${diff} dia${diff > 1 ? "s" : ""}: ${client.name} — ${amount}`, severity: "warning", relatedId: client.id });
          } else {
            alerts.push({ id: `debtor-${client.id}`, type: "debtor", message: `${client.name} possui dívida de ${amount} — vence em ${client.debtDueDate}`, severity: "warning", relatedId: client.id });
          }
        }
      } else {
        alerts.push({ id: `debtor-${client.id}`, type: "debtor", message: `${client.name} possui dívida de ${amount}`, severity: "danger", relatedId: client.id });
      }
    }
  }

  for (const task of tasks) {
    if (task.status === "pending" && task.dueDate < today) {
      alerts.push({ id: `overdue-task-${task.id}`, type: "overdue_task", message: `Tarefa atrasada: ${task.title}`, severity: "danger", relatedId: task.id });
    }
  }

  for (const item of inventory) {
    if (item.quantity <= item.minQuantity) {
      alerts.push({ id: `low-stock-${item.id}`, type: "low_stock", message: `Estoque baixo: ${item.name} (${item.quantity} restantes)`, severity: "warning", relatedId: item.id });
    }
  }

  res.json(alerts);
});

router.get("/dashboard/revenue-chart", async (req, res) => {
  const tid = getTenantId(req);
  const period = (req.query.period as string) || "monthly";
  const transactions = await db.select().from(transactionsTable).where(eq(transactionsTable.tenantId, tid));

  type ChartPoint = { label: string; receitas: number; despesas: number; lucro: number };
  const now = new Date();

  if (period === "weekly") {
    const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const days: ChartPoint[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayLabel = i === 0 ? "Hoje" : i === 1 ? "Ontem" : dayNames[d.getDay()];
      const dayTxs = transactions.filter((t) => t.createdAt.toISOString().split("T")[0] === dateStr && !t.isReceivable);
      const receitas = dayTxs.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
      const despesas = dayTxs.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
      days.push({ label: dayLabel, receitas, despesas, lucro: receitas - despesas });
    }
    res.json(days); return;
  }

  if (period === "monthly") {
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const months: ChartPoint[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yr = d.getFullYear(), mo = d.getMonth() + 1;
      const label = i === 0 ? "Este mês" : `${monthNames[d.getMonth()]}${yr !== now.getFullYear() ? `/${String(yr).slice(2)}` : ""}`;
      const monthTxs = transactions.filter((t) => { const td = t.createdAt; return td.getFullYear() === yr && td.getMonth() + 1 === mo && !t.isReceivable; });
      const receitas = monthTxs.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
      const despesas = monthTxs.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
      months.push({ label, receitas, despesas, lucro: receitas - despesas });
    }
    res.json(months); return;
  }

  if (period === "annual") {
    const years: ChartPoint[] = [];
    for (let i = 4; i >= 0; i--) {
      const yr = now.getFullYear() - i;
      const yearTxs = transactions.filter((t) => t.createdAt.getFullYear() === yr && !t.isReceivable);
      const receitas = yearTxs.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
      const despesas = yearTxs.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
      years.push({ label: i === 0 ? "Este ano" : String(yr), receitas, despesas, lucro: receitas - despesas });
    }
    res.json(years); return;
  }

  res.json([]);
});

export default router;
