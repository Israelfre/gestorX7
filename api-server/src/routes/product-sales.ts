import { Router } from "express";
import { eq, desc, and, sql } from "drizzle-orm";
import { db, productSalesTable, inventoryTable, transactionsTable, clientsTable, employeesTable } from "@workspace/db";
import { getTenantId } from "../middleware/auth";
import { z } from "zod";

const router = Router();

const saleItemSchema = z.object({
  inventoryId: z.number().int().positive(),
  name: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().min(0),
  total: z.number().min(0),
});

const createSaleSchema = z.object({
  clientId: z.number().int().positive().optional().nullable(),
  clientName: z.string().optional().nullable(),
  employeeId: z.number().int().positive().optional().nullable(),
  commissionPct: z.number().min(0).max(100).optional().nullable(),
  items: z.array(saleItemSchema).min(1),
  paymentType: z.enum(["avista", "aprazo"]).default("avista"),
  paymentMethod: z.enum(["pix", "cartao_credito", "cartao_debito", "dinheiro", "boleto", "crediario"]).default("dinheiro"),
  installments: z.number().int().min(1).max(48).default(1),
  subtotal: z.number().min(0),
  discount: z.number().min(0).default(0),
  total: z.number().min(0),
  notes: z.string().optional().nullable(),
});

const returnSchema = z.object({ items: z.array(z.object({ inventoryId: z.number().int().positive(), name: z.string(), quantity: z.number().int().positive(), unitPrice: z.number().min(0), total: z.number().min(0) })).min(1) });

const methodLabels: Record<string, string> = { pix: "PIX", cartao_credito: "Crédito", cartao_debito: "Débito", dinheiro: "Dinheiro", boleto: "Boleto", crediario: "Crediário" };

function formatSale(s: typeof productSalesTable.$inferSelect) {
  return { ...s, subtotal: Number(s.subtotal), discount: Number(s.discount), total: Number(s.total), commissionPct: s.commissionPct != null ? Number(s.commissionPct) : null, items: JSON.parse(s.items), returnedItems: s.returnedItems ? JSON.parse(s.returnedItems) : null, returnTotal: s.returnTotal != null ? Number(s.returnTotal) : null, returnedAt: s.returnedAt ? s.returnedAt.toISOString() : null, createdAt: s.createdAt.toISOString() };
}

router.get("/product-sales", async (req, res) => {
  const tid = getTenantId(req);
  const rows = await db.select().from(productSalesTable).where(eq(productSalesTable.tenantId, tid)).orderBy(desc(productSalesTable.createdAt));
  res.json(rows.map(formatSale));
});

router.get("/product-sales/:id", async (req, res) => {
  const tid = getTenantId(req);
  const [row] = await db.select().from(productSalesTable).where(and(eq(productSalesTable.id, Number(req.params.id)), eq(productSalesTable.tenantId, tid)));
  if (!row) { res.status(404).json({ error: "Venda não encontrada" }); return; }
  res.json(formatSale(row));
});

router.post("/product-sales", async (req, res) => {
  const tid = getTenantId(req);
  const body = createSaleSchema.parse(req.body);

  for (const item of body.items) {
    const [inv] = await db.select().from(inventoryTable).where(and(eq(inventoryTable.id, item.inventoryId), eq(inventoryTable.tenantId, tid)));
    if (!inv) { res.status(400).json({ error: `Produto não encontrado: ${item.name}` }); return; }
    if (inv.quantity < item.quantity) { res.status(400).json({ error: `Estoque insuficiente para "${inv.name}": disponível ${inv.quantity}, solicitado ${item.quantity}` }); return; }
  }

  let resolvedClientName = body.clientName ?? null;
  if (body.clientId && !resolvedClientName) {
    const [client] = await db.select().from(clientsTable).where(and(eq(clientsTable.id, body.clientId), eq(clientsTable.tenantId, tid)));
    if (client) resolvedClientName = client.name;
  }

  let resolvedSellerName: string | null = null;
  let resolvedCommissionPct: number | null = null;
  if (body.employeeId) {
    const [emp] = await db.select().from(employeesTable).where(and(eq(employeesTable.id, body.employeeId), eq(employeesTable.tenantId, tid)));
    if (emp) { resolvedSellerName = emp.name; resolvedCommissionPct = body.commissionPct != null ? body.commissionPct : Number(emp.commissionRate); }
  }

  const methodLabel = methodLabels[body.paymentMethod] ?? body.paymentMethod;
  const installmentNote = body.installments > 1 ? ` (${body.installments}x)` : "";
  const paymentTypeLabel = body.paymentType === "avista" ? "À Vista" : "A Prazo";
  const txDescription = `Venda${resolvedClientName ? ` — ${resolvedClientName}` : ""}${resolvedSellerName ? ` · Vendedor: ${resolvedSellerName}` : ""} · ${paymentTypeLabel} · ${methodLabel}${installmentNote}`;

  const [sale] = await db.insert(productSalesTable).values({
    tenantId: tid,
    clientId: body.clientId ?? null, clientName: resolvedClientName, employeeId: body.employeeId ?? null, sellerName: resolvedSellerName,
    commissionPct: resolvedCommissionPct != null ? String(resolvedCommissionPct) : null,
    items: JSON.stringify(body.items), paymentType: body.paymentType, paymentMethod: body.paymentMethod, installments: body.installments,
    subtotal: String(body.subtotal), discount: String(body.discount), total: String(body.total), notes: body.notes ?? null,
  }).returning();

  await Promise.all(body.items.map((item) => db.update(inventoryTable).set({ quantity: sql`quantity - ${item.quantity}` }).where(eq(inventoryTable.id, item.inventoryId))));
  await db.insert(transactionsTable).values({ tenantId: tid, type: "income", amount: String(body.total), description: txDescription, clientId: body.clientId ?? null, isReceivable: body.paymentType === "aprazo" });

  res.status(201).json(formatSale(sale));
});

router.post("/product-sales/:id/return", async (req, res) => {
  const id = Number(req.params.id);
  const tid = getTenantId(req);
  const [sale] = await db.select().from(productSalesTable).where(and(eq(productSalesTable.id, id), eq(productSalesTable.tenantId, tid)));
  if (!sale) { res.status(404).json({ error: "Venda não encontrada" }); return; }

  const body = returnSchema.parse(req.body);
  const soldItems: { inventoryId: number; name: string; quantity: number; unitPrice: number; total: number }[] = JSON.parse(sale.items);
  const previousReturns: typeof body.items = sale.returnedItems ? JSON.parse(sale.returnedItems) : [];

  for (const ret of body.items) {
    const soldItem = soldItems.find((i) => i.inventoryId === ret.inventoryId);
    if (!soldItem) { res.status(400).json({ error: `Item "${ret.name}" não pertence a esta venda` }); return; }
    const alreadyReturned = previousReturns.filter((r) => r.inventoryId === ret.inventoryId).reduce((sum, r) => sum + r.quantity, 0);
    const maxReturn = soldItem.quantity - alreadyReturned;
    if (ret.quantity > maxReturn) { res.status(400).json({ error: `Devolução de "${ret.name}" excede o saldo disponível (máx: ${maxReturn})` }); return; }
  }

  const mergedReturns = [...previousReturns];
  for (const ret of body.items) {
    const existing = mergedReturns.find((r) => r.inventoryId === ret.inventoryId);
    if (existing) { existing.quantity += ret.quantity; existing.total += ret.total; }
    else { mergedReturns.push({ ...ret }); }
  }

  const returnTotal = body.items.reduce((sum, r) => sum + r.total, 0);
  const itemNames = body.items.map((i) => `${i.quantity}× ${i.name}`).join(", ");

  await Promise.all(body.items.map((item) => db.update(inventoryTable).set({ quantity: sql`quantity + ${item.quantity}` }).where(eq(inventoryTable.id, item.inventoryId))));
  await db.insert(transactionsTable).values({ tenantId: tid, type: "expense", amount: String(returnTotal), description: `Devolução${sale.clientName ? ` — ${sale.clientName}` : ""} · ${itemNames}`, clientId: sale.clientId ?? null, isReceivable: false });

  const [updated] = await db.update(productSalesTable).set({ returnedItems: JSON.stringify(mergedReturns), returnTotal: String(Number(sale.returnTotal ?? 0) + returnTotal), returnedAt: new Date() }).where(eq(productSalesTable.id, id)).returning();
  res.json(formatSale(updated));
});

router.delete("/product-sales/:id", async (req, res) => {
  const id = Number(req.params.id);
  const tid = getTenantId(req);
  const [sale] = await db.select().from(productSalesTable).where(and(eq(productSalesTable.id, id), eq(productSalesTable.tenantId, tid)));
  if (!sale) { res.status(404).json({ error: "Venda não encontrada" }); return; }

  const items: { inventoryId: number; quantity: number }[] = JSON.parse(sale.items);
  const returnedItems: { inventoryId: number; quantity: number }[] = sale.returnedItems ? JSON.parse(sale.returnedItems) : [];
  const netItems = items.map((item) => { const returned = returnedItems.filter((r) => r.inventoryId === item.inventoryId).reduce((sum, r) => sum + r.quantity, 0); return { ...item, quantity: Math.max(0, item.quantity - returned) }; }).filter((i) => i.quantity > 0);

  await Promise.all(netItems.map((item) => db.update(inventoryTable).set({ quantity: sql`quantity + ${item.quantity}` }).where(eq(inventoryTable.id, item.inventoryId))));
  await db.delete(productSalesTable).where(eq(productSalesTable.id, id));
  res.status(204).send();
});

export default router;
