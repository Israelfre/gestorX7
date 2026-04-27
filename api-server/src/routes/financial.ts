import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, transactionsTable, clientsTable } from "@workspace/db";
import { getTenantId } from "../middleware/auth";
import { z } from "zod";

const router = Router();

const createTransactionBodySchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.number().positive(),
  description: z.string().min(1),
  clientId: z.number().optional(),
  isReceivable: z.boolean().optional().default(false),
  dueDate: z.string().optional(),
});

async function buildClientMap(tenantId: number) {
  const allClients = await db.select().from(clientsTable).where(eq(clientsTable.tenantId, tenantId));
  const map: Record<number, string> = {};
  allClients.forEach((c) => { map[c.id] = c.name; });
  return map;
}

router.get("/financial/transactions", async (req, res) => {
  const tid = getTenantId(req);
  const { month, year } = req.query;
  const transactions = await db.select().from(transactionsTable).where(eq(transactionsTable.tenantId, tid)).orderBy(transactionsTable.createdAt);
  const clientMap = await buildClientMap(tid);

  let filtered = transactions;
  if (month && year) {
    const m = String(month).padStart(2, "0");
    const y = String(year);
    filtered = transactions.filter((t) => t.createdAt.toISOString().startsWith(`${y}-${m}`));
  }

  res.json(filtered.map((t) => ({
    ...t,
    amount: Number(t.amount),
    clientName: t.clientId ? clientMap[t.clientId] ?? null : null,
    createdAt: t.createdAt.toISOString(),
  })));
});

router.post("/financial/transactions", async (req, res) => {
  const tid = getTenantId(req);
  const body = createTransactionBodySchema.parse(req.body);
  const [transaction] = await db.insert(transactionsTable).values({
    tenantId: tid,
    type: body.type,
    amount: String(body.amount),
    description: body.description,
    clientId: body.clientId ?? null,
    isReceivable: body.isReceivable ?? false,
    dueDate: body.dueDate ?? null,
  }).returning();

  let clientName: string | null = null;
  if (transaction.clientId) {
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, transaction.clientId));
    clientName = client?.name ?? null;
  }

  res.status(201).json({ ...transaction, amount: Number(transaction.amount), clientName, createdAt: transaction.createdAt.toISOString() });
});

router.delete("/financial/transactions/:id", async (req, res) => {
  const id = Number(req.params.id);
  const tid = getTenantId(req);
  await db.delete(transactionsTable).where(and(eq(transactionsTable.id, id), eq(transactionsTable.tenantId, tid)));
  res.status(204).send();
});

router.get("/financial/summary", async (req, res) => {
  const tid = getTenantId(req);
  const { month, year } = req.query;
  const allTransactions = await db.select().from(transactionsTable).where(eq(transactionsTable.tenantId, tid)).orderBy(transactionsTable.createdAt);
  const clientMap = await buildClientMap(tid);

  let transactions = allTransactions;
  if (month && year) {
    const m = String(month).padStart(2, "0");
    const y = String(year);
    transactions = allTransactions.filter((t) => t.createdAt.toISOString().startsWith(`${y}-${m}`));
  }

  let totalIncome = 0;
  let totalExpenses = 0;
  let totalReceivable = 0;

  for (const t of transactions) {
    const amount = Number(t.amount);
    if (t.isReceivable) { totalReceivable += amount; }
    else if (t.type === "income") { totalIncome += amount; }
    else { totalExpenses += amount; }
  }

  const balance = totalIncome - totalExpenses;

  const recentTransactions = allTransactions.slice(-10).reverse().map((t) => ({
    ...t,
    amount: Number(t.amount),
    clientName: t.clientId ? clientMap[t.clientId] ?? null : null,
    createdAt: t.createdAt.toISOString(),
  }));

  res.json({ balance, totalIncome, totalExpenses, totalReceivable, recentTransactions });
});

export default router;
