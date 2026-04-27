import { Router } from "express";
import { db, caixaSessionsTable, transactionsTable } from "@workspace/db";
import { eq, and, gte, desc } from "drizzle-orm";

const router = Router();

// GET /api/caixa/current — sessão aberta no tenant
router.get("/caixa/current", async (req, res) => {
  const tenantId = req.session.tenantId!;
  const [session] = await db
    .select()
    .from(caixaSessionsTable)
    .where(and(eq(caixaSessionsTable.tenantId, tenantId), eq(caixaSessionsTable.status, "open")))
    .orderBy(desc(caixaSessionsTable.openedAt))
    .limit(1);

  if (!session) return res.json({ open: false, session: null });

  // Todas as transações financeiras desde a abertura do caixa
  // (vendas de produtos já geram transactions com type="income" automaticamente)
  const sinceOpen = session.openedAt;
  const transactions = await db
    .select()
    .from(transactionsTable)
    .where(and(eq(transactionsTable.tenantId, tenantId), gte(transactionsTable.createdAt, sinceOpen)))
    .orderBy(transactionsTable.createdAt);

  const entradas = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const saidas = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);

  const recentTransactions = [...transactions].reverse().slice(0, 20).map((t) => ({
    id: t.id,
    type: t.type,
    amount: Number(t.amount),
    description: t.description,
    createdAt: t.createdAt.toISOString(),
  }));

  return res.json({
    open: true,
    session: {
      id: session.id,
      openedAt: session.openedAt.toISOString(),
      openedByName: session.openedByName,
      initialAmount: Number(session.initialAmount),
    },
    summary: {
      entradas,
      saidas,
      saldo: Number(session.initialAmount) + entradas - saidas,
    },
    recentTransactions,
  });
});

// GET /api/caixa/history — histórico de sessões
router.get("/caixa/history", async (req, res) => {
  const tenantId = req.session.tenantId!;
  const sessions = await db
    .select()
    .from(caixaSessionsTable)
    .where(eq(caixaSessionsTable.tenantId, tenantId))
    .orderBy(desc(caixaSessionsTable.openedAt))
    .limit(30);

  return res.json(
    sessions.map((s) => ({
      id: s.id,
      status: s.status,
      openedAt: s.openedAt.toISOString(),
      closedAt: s.closedAt ? s.closedAt.toISOString() : null,
      openedByName: s.openedByName,
      closedByName: s.closedByName,
      initialAmount: Number(s.initialAmount),
      finalAmount: s.finalAmount != null ? Number(s.finalAmount) : null,
      totalEntradas: s.totalEntradas != null ? Number(s.totalEntradas) : null,
      totalSaidas: s.totalSaidas != null ? Number(s.totalSaidas) : null,
      diferenca: s.diferenca != null ? Number(s.diferenca) : null,
      observations: s.observations,
    }))
  );
});

// POST /api/caixa/open — abrir caixa
router.post("/caixa/open", async (req, res) => {
  const tenantId = req.session.tenantId!;
  const userId = req.session.userId!;
  const userName = req.session.name ?? "Usuário";

  const [existing] = await db
    .select()
    .from(caixaSessionsTable)
    .where(and(eq(caixaSessionsTable.tenantId, tenantId), eq(caixaSessionsTable.status, "open")))
    .limit(1);

  if (existing) {
    return res.status(409).json({ error: "Já existe um caixa aberto." });
  }

  const { initialAmount = 0, observations } = req.body;

  const [session] = await db
    .insert(caixaSessionsTable)
    .values({
      tenantId,
      openedBy: userId,
      openedByName: userName,
      initialAmount: String(Number(initialAmount).toFixed(2)),
      observations: observations || null,
      status: "open",
    })
    .returning();

  return res.status(201).json({
    id: session.id,
    openedAt: session.openedAt.toISOString(),
    openedByName: session.openedByName,
    initialAmount: Number(session.initialAmount),
  });
});

// POST /api/caixa/close — fechar caixa
router.post("/caixa/close", async (req, res) => {
  const tenantId = req.session.tenantId!;
  const userId = req.session.userId!;
  const userName = req.session.name ?? "Usuário";

  const [session] = await db
    .select()
    .from(caixaSessionsTable)
    .where(and(eq(caixaSessionsTable.tenantId, tenantId), eq(caixaSessionsTable.status, "open")))
    .orderBy(desc(caixaSessionsTable.openedAt))
    .limit(1);

  if (!session) {
    return res.status(404).json({ error: "Nenhum caixa aberto encontrado." });
  }

  const sinceOpen = session.openedAt;
  const now = new Date();

  const transactions = await db
    .select()
    .from(transactionsTable)
    .where(and(eq(transactionsTable.tenantId, tenantId), gte(transactionsTable.createdAt, sinceOpen)));

  const totalEntradas = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalSaidas = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);

  const { finalAmount, observations } = req.body;
  const expectedAmount = Number(session.initialAmount) + totalEntradas - totalSaidas;
  const realFinal = finalAmount != null ? Number(finalAmount) : expectedAmount;
  const diferenca = realFinal - expectedAmount;

  await db
    .update(caixaSessionsTable)
    .set({
      status: "closed",
      closedAt: now,
      closedBy: userId,
      closedByName: userName,
      finalAmount: String(realFinal.toFixed(2)),
      totalEntradas: String(totalEntradas.toFixed(2)),
      totalSaidas: String(totalSaidas.toFixed(2)),
      diferenca: String(diferenca.toFixed(2)),
      observations: observations || session.observations,
    })
    .where(eq(caixaSessionsTable.id, session.id));

  return res.json({
    closed: true,
    summary: {
      initialAmount: Number(session.initialAmount),
      totalEntradas,
      totalSaidas,
      expectedAmount,
      finalAmount: realFinal,
      diferenca,
    },
  });
});

export default router;
