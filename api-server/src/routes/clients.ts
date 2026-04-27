import { Router } from "express";
import { eq, desc, and, or, isNull } from "drizzle-orm";
import { db, clientsTable, transactionsTable, tasksTable, quotesTable, debtPaymentsTable, productSalesTable } from "@workspace/db";
import { getTenantId } from "../middleware/auth";
import { z } from "zod";

const router = Router();

const createClientBodySchema = z.object({
  name: z.string().min(1),
  fantasia: z.string().optional().nullable(),
  personType: z.enum(["PF", "PJ"]).default("PF"),
  cnpj: z.string().optional().default(""),
  phone: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  notes: z.string().optional(),
  isDebtor: z.boolean().optional().default(false),
  debtAmount: z.number().optional().default(0),
  debtDueDate: z.string().optional().nullable(),
  cep: z.string().optional().nullable(),
  logradouro: z.string().optional().nullable(),
  numero: z.string().optional().nullable(),
  complemento: z.string().optional().nullable(),
  bairro: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  estado: z.string().optional().nullable(),
});

const debtPaymentSchema = z.object({
  amount: z.number().positive("Valor deve ser maior que zero"),
  paymentMethod: z.enum(["pix", "cartao_credito", "cartao_debito", "dinheiro", "boleto", "crediario"]),
  installments: z.number().int().min(1).max(48).default(1),
  notes: z.string().optional(),
});

function formatClient(c: typeof clientsTable.$inferSelect) {
  const phone = c.phone.replace(/\D/g, "");
  const whatsappUrl = `https://wa.me/55${phone}`;
  return { ...c, debtAmount: Number(c.debtAmount), debtPaidAmount: Number(c.debtPaidAmount ?? 0), whatsappUrl, createdAt: c.createdAt.toISOString() };
}

router.get("/clients", async (req, res) => {
  const tid = getTenantId(req);
  const clients = await db.select().from(clientsTable).where(eq(clientsTable.tenantId, tid)).orderBy(clientsTable.name);
  res.json(clients.map(formatClient));
});

router.post("/clients", async (req, res) => {
  const tid = getTenantId(req);
  const body = createClientBodySchema.parse(req.body);
  const [client] = await db.insert(clientsTable).values({
    tenantId: tid,
    name: body.name,
    fantasia: body.fantasia ?? null,
    personType: body.personType ?? "PF",
    cnpj: body.cnpj ?? "",
    phone: body.phone,
    email: body.email || null,
    notes: body.notes ?? null,
    isDebtor: body.isDebtor ?? false,
    debtAmount: String(body.debtAmount ?? 0),
    debtPaidAmount: "0",
    debtDueDate: body.debtDueDate ?? null,
    cep: body.cep ?? null,
    logradouro: body.logradouro ?? null,
    numero: body.numero ?? null,
    complemento: body.complemento ?? null,
    bairro: body.bairro ?? null,
    cidade: body.cidade ?? null,
    estado: body.estado ?? null,
  }).returning();
  res.status(201).json(formatClient(client));
});

router.get("/clients/:id", async (req, res) => {
  const id = Number(req.params.id);
  const tid = getTenantId(req);
  const [client] = await db.select().from(clientsTable).where(and(eq(clientsTable.id, id), eq(clientsTable.tenantId, tid)));
  if (!client) { res.status(404).json({ error: "Client not found" }); return; }
  res.json(formatClient(client));
});

router.put("/clients/:id", async (req, res) => {
  const id = Number(req.params.id);
  const tid = getTenantId(req);
  const body = createClientBodySchema.parse(req.body);
  const [client] = await db.update(clientsTable).set({
    name: body.name, fantasia: body.fantasia ?? null, personType: body.personType ?? "PF", cnpj: body.cnpj ?? "",
    phone: body.phone, email: body.email || null, notes: body.notes ?? null,
    isDebtor: body.isDebtor ?? false, debtAmount: String(body.debtAmount ?? 0),
    debtDueDate: body.debtDueDate ?? null, cep: body.cep ?? null, logradouro: body.logradouro ?? null,
    numero: body.numero ?? null, complemento: body.complemento ?? null, bairro: body.bairro ?? null,
    cidade: body.cidade ?? null, estado: body.estado ?? null,
  }).where(and(eq(clientsTable.id, id), eq(clientsTable.tenantId, tid))).returning();
  if (!client) { res.status(404).json({ error: "Client not found" }); return; }
  res.json(formatClient(client));
});

router.delete("/clients/:id", async (req, res) => {
  const id = Number(req.params.id);
  const tid = getTenantId(req);
  await db.delete(clientsTable).where(and(eq(clientsTable.id, id), eq(clientsTable.tenantId, tid)));
  res.status(204).send();
});

// ─── Debt Payments ───────────────────────────────────────────────
router.get("/clients/:id/debt-payments", async (req, res) => {
  const id = Number(req.params.id);
  const payments = await db.select().from(debtPaymentsTable).where(eq(debtPaymentsTable.clientId, id)).orderBy(desc(debtPaymentsTable.paidAt));
  res.json(payments.map((p) => ({ ...p, amount: Number(p.amount) })));
});

router.post("/clients/:id/debt-payment", async (req, res) => {
  const id = Number(req.params.id);
  const tid = getTenantId(req);
  const body = debtPaymentSchema.parse(req.body);

  const [client] = await db.select().from(clientsTable).where(and(eq(clientsTable.id, id), eq(clientsTable.tenantId, tid)));
  if (!client) { res.status(404).json({ error: "Client not found" }); return; }

  const totalDebt = Number(client.debtAmount);
  const alreadyPaid = Number(client.debtPaidAmount ?? 0);
  const remaining = totalDebt - alreadyPaid;

  if (body.amount > remaining + 0.01) {
    res.status(400).json({ error: `Valor excede o saldo devedor restante de R$ ${remaining.toFixed(2)}` }); return;
  }

  const newPaidAmount = alreadyPaid + body.amount;
  const isFullyPaid = newPaidAmount >= totalDebt - 0.01;

  const methodLabels: Record<string, string> = { pix: "PIX", cartao_credito: "Crédito", cartao_debito: "Débito", dinheiro: "Dinheiro", boleto: "Boleto", crediario: "Crediário" };
  const methodLabel = methodLabels[body.paymentMethod] ?? body.paymentMethod;
  const installmentNote = body.installments > 1 ? ` (${body.installments}x)` : "";
  const txDescription = `Recebimento de dívida — ${client.name} · ${methodLabel}${installmentNote}${body.notes ? ` · ${body.notes}` : ""}`;

  await Promise.all([
    db.insert(debtPaymentsTable).values({ clientId: id, amount: String(body.amount), paymentMethod: body.paymentMethod, installments: body.installments, notes: body.notes ?? null }),
    db.insert(transactionsTable).values({ tenantId: tid, type: "income", amount: String(body.amount), description: txDescription, clientId: id, isReceivable: false }),
  ]);

  const [updated] = await db.update(clientsTable).set({ debtPaidAmount: String(newPaidAmount), isDebtor: !isFullyPaid, debtAmount: isFullyPaid ? "0" : String(totalDebt) }).where(eq(clientsTable.id, id)).returning();

  // Se a dívida foi quitada completamente, libera a comissão das vendas a prazo deste cliente
  // Busca tanto pelo clientId quanto pelo clientName (caso venda tenha sido registrada sem link)
  if (isFullyPaid) {
    await db.update(productSalesTable)
      .set({ paymentType: "avista" })
      .where(
        and(
          eq(productSalesTable.paymentType, "aprazo"),
          or(
            eq(productSalesTable.clientId, id),
            and(isNull(productSalesTable.clientId), eq(productSalesTable.clientName, updated.name))
          )
        )
      );
  }

  res.json({ client: formatClient(updated), fullyPaid: isFullyPaid });
});

// ─── Mark as debtor ───────────────────────────────────────────────
router.patch("/clients/:id/mark-debtor", async (req, res) => {
  const id = Number(req.params.id);
  const tid = getTenantId(req);
  const body = z.object({
    debtAmount: z.number().positive(),
    debtDueDate: z.string().nullable().optional(),
    origin: z.string().optional(),
  }).parse(req.body);

  const [client] = await db.select().from(clientsTable).where(and(eq(clientsTable.id, id), eq(clientsTable.tenantId, tid)));
  if (!client) { res.status(404).json({ error: "Client not found" }); return; }

  const [updated] = await db.update(clientsTable).set({
    isDebtor: true,
    debtAmount: String(body.debtAmount),
    debtPaidAmount: "0",
    debtDueDate: body.debtDueDate ?? null,
  }).where(and(eq(clientsTable.id, id), eq(clientsTable.tenantId, tid))).returning();

  res.json(formatClient(updated));
});

// ─── Client history ───────────────────────────────────────────────
router.get("/clients/:id/history", async (req, res) => {
  const id = Number(req.params.id);
  const tid = getTenantId(req);
  const [client] = await db.select().from(clientsTable).where(and(eq(clientsTable.id, id), eq(clientsTable.tenantId, tid)));
  if (!client) { res.status(404).json({ error: "Client not found" }); return; }

  const [transactions, tasks, quotes, payments] = await Promise.all([
    db.select().from(transactionsTable).where(eq(transactionsTable.clientId, id)),
    db.select().from(tasksTable).where(eq(tasksTable.clientId, id)),
    db.select().from(quotesTable).where(eq(quotesTable.clientId, id)),
    db.select().from(debtPaymentsTable).where(eq(debtPaymentsTable.clientId, id)).orderBy(desc(debtPaymentsTable.paidAt)),
  ]);

  const today = new Date().toISOString().split("T")[0];
  res.json({
    client: formatClient(client),
    transactions: transactions.map((t) => ({ ...t, amount: Number(t.amount), clientName: client.name, createdAt: t.createdAt.toISOString() })),
    tasks: tasks.map((t) => ({ ...t, clientName: client.name, isOverdue: t.status === "pending" && t.dueDate < today, createdAt: t.createdAt.toISOString() })),
    quotes: quotes.map((q) => ({ ...q, amount: Number(q.amount), clientName: client.name, createdAt: q.createdAt.toISOString() })),
    debtPayments: payments.map((p) => ({ ...p, amount: Number(p.amount), paidAt: p.paidAt.toISOString() })),
  });
});

export default router;
