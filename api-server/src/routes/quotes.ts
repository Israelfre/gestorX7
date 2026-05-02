import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, quotesTable, clientsTable, transactionsTable } from "@workspace/db";
import { getTenantId } from "../middleware/auth";
import { z } from "zod";

const router = Router();

const createQuoteBodySchema = z.object({
  clientId: z.number().optional().nullable(),
  employeeId: z.number().optional().nullable(),
  sellerName: z.string().optional().nullable(),
  commissionPct: z.number().min(0).max(100).optional().nullable(),
  description: z.string().min(1),
  subtotal: z.number().optional().nullable(),
  discount: z.number().optional().nullable(),
  amount: z.number().positive(),
  additionalNotes: z.string().optional().nullable(),
});

const updateQuoteBodySchema = z.object({
  clientId: z.number().optional().nullable(),
  employeeId: z.number().optional().nullable(),
  sellerName: z.string().optional().nullable(),
  commissionPct: z.number().min(0).max(100).optional().nullable(),
  description: z.string().min(1).optional(),
  subtotal: z.number().optional().nullable(),
  discount: z.number().optional().nullable(),
  amount: z.number().positive().optional(),
  status: z.enum(["pending", "converted", "rejected"]).optional(),
  additionalNotes: z.string().optional().nullable(),
});

const paymentTypeLabels: Record<string, string> = {
  avista: "À Vista",
  pix: "PIX",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
  boleto: "Boleto",
  aprazo: "A Prazo",
};

function quoteWithMeta(q: typeof quotesTable.$inferSelect, allClientMap: Record<number, string>) {
  const commissionPct = Number(q.commissionPct ?? 0);
  const amount = Number(q.amount);
  return {
    ...q,
    amount,
    subtotal: q.subtotal != null ? Number(q.subtotal) : null,
    discount: q.discount != null ? Number(q.discount) : null,
    commissionPct,
    commissionAmount: commissionPct > 0 ? parseFloat(((amount * commissionPct) / 100).toFixed(2)) : 0,
    clientName: q.clientId ? allClientMap[q.clientId] ?? null : null,
    paymentType: q.paymentType ?? null,
    paymentTypeLabel: q.paymentType ? (paymentTypeLabels[q.paymentType] ?? q.paymentType) : null,
    createdAt: q.createdAt.toISOString(),
  };
}

router.get("/quotes", async (req, res) => {
  const tid = getTenantId(req);
  const quotes = await db.select().from(quotesTable).where(eq(quotesTable.tenantId, tid)).orderBy(quotesTable.createdAt);
  const allClients = await db.select().from(clientsTable).where(eq(clientsTable.tenantId, tid));
  const allClientMap: Record<number, string> = {};
  allClients.forEach((c) => { allClientMap[c.id] = c.name; });
  res.json(quotes.map((q) => quoteWithMeta(q, allClientMap)));
});

router.post("/quotes", async (req, res) => {
  const tid = getTenantId(req);
  const body = createQuoteBodySchema.parse(req.body);
  const commissionPct = body.commissionPct ?? 0;
  const commissionAmount = commissionPct > 0 ? (body.amount * commissionPct) / 100 : 0;

  const [quote] = await db.insert(quotesTable).values({
    tenantId: tid,
    clientId: body.clientId ?? null,
    employeeId: body.employeeId ?? null,
    sellerName: body.sellerName ?? null,
    commissionPct: String(commissionPct),
    commissionAmount: String(commissionAmount.toFixed(2)),
    description: body.description,
    subtotal: body.subtotal != null ? String(body.subtotal) : null,
    discount: body.discount != null ? String(body.discount) : "0",
    amount: String(body.amount),
    status: "pending",
    additionalNotes: body.additionalNotes ?? null,
  }).returning();

  const allClients = await db.select().from(clientsTable).where(eq(clientsTable.tenantId, tid));
  const allClientMap: Record<number, string> = {};
  allClients.forEach((c) => { allClientMap[c.id] = c.name; });
  res.status(201).json(quoteWithMeta(quote, allClientMap));
});

router.put("/quotes/:id", async (req, res) => {
  const id = Number(req.params.id);
  const tid = getTenantId(req);
  const body = updateQuoteBodySchema.parse(req.body);

  const updateData: Partial<typeof quotesTable.$inferInsert> = {};
  if (body.clientId !== undefined) updateData.clientId = body.clientId;
  if (body.employeeId !== undefined) updateData.employeeId = body.employeeId;
  if (body.sellerName !== undefined) updateData.sellerName = body.sellerName;
  if (body.commissionPct !== undefined) {
    updateData.commissionPct = String(body.commissionPct ?? 0);
  }
  if (body.description !== undefined) updateData.description = body.description;
  if (body.subtotal !== undefined) updateData.subtotal = body.subtotal != null ? String(body.subtotal) : null;
  if (body.discount !== undefined) updateData.discount = body.discount != null ? String(body.discount) : "0";
  if (body.amount !== undefined) {
    updateData.amount = String(body.amount);
    if (body.commissionPct != null && body.commissionPct > 0) {
      updateData.commissionAmount = String(((body.amount * body.commissionPct) / 100).toFixed(2));
    }
  }
  if (body.status !== undefined) updateData.status = body.status;
  if (body.additionalNotes !== undefined) updateData.additionalNotes = body.additionalNotes;

  const [quote] = await db.update(quotesTable).set(updateData).where(and(eq(quotesTable.id, id), eq(quotesTable.tenantId, tid))).returning();
  if (!quote) { res.status(404).json({ error: "Quote not found" }); return; }

  const allClients = await db.select().from(clientsTable).where(eq(clientsTable.tenantId, tid));
  const allClientMap: Record<number, string> = {};
  allClients.forEach((c) => { allClientMap[c.id] = c.name; });
  res.json(quoteWithMeta(quote, allClientMap));
});

router.delete("/quotes/:id", async (req, res) => {
  const id = Number(req.params.id);
  const tid = getTenantId(req);
  await db.delete(quotesTable).where(and(eq(quotesTable.id, id), eq(quotesTable.tenantId, tid)));
  res.status(204).send();
});

router.post("/quotes/:id/convert", async (req, res) => {
  const id = Number(req.params.id);
  const tid = getTenantId(req);
  const paymentType: string = req.body?.paymentType ?? "avista";

  const [quote] = await db.select().from(quotesTable).where(and(eq(quotesTable.id, id), eq(quotesTable.tenantId, tid)));
  if (!quote) { res.status(404).json({ error: "Quote not found" }); return; }
  if (quote.status !== "pending") { res.status(400).json({ error: "Quote is not pending" }); return; }

  await db.update(quotesTable).set({ status: "converted", paymentType }).where(eq(quotesTable.id, id));

  const [transaction] = await db.insert(transactionsTable).values({
    tenantId: tid,
    type: "income",
    amount: quote.amount,
    description: `Venda - ${quote.description}`,
    clientId: quote.clientId,
    isReceivable: false,
  }).returning();

  let clientName: string | null = null;
  if (transaction.clientId) {
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, transaction.clientId));
    clientName = client?.name ?? null;
  }

  res.json({ ...transaction, amount: Number(transaction.amount), clientName, createdAt: transaction.createdAt.toISOString() });
});

export default router;
