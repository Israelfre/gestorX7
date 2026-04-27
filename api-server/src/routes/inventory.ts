import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, inventoryTable } from "@workspace/db";
import { getTenantId } from "../middleware/auth";
import { z } from "zod";

const router = Router();

const createInventoryBodySchema = z.object({
  name: z.string().min(1),
  supplier: z.string().optional().nullable(),
  quantity: z.number().int().min(0),
  minQuantity: z.number().int().min(0).optional().default(5),
  costPrice: z.number().min(0).optional().default(0),
  price: z.number().min(0).optional().default(0),
  priceAPrazo: z.number().min(0).optional().default(0),
});

const updateInventoryBodySchema = z.object({
  name: z.string().min(1).optional(),
  supplier: z.string().optional().nullable(),
  quantity: z.number().int().min(0).optional(),
  minQuantity: z.number().int().min(0).optional(),
  costPrice: z.number().min(0).optional(),
  price: z.number().min(0).optional(),
  priceAPrazo: z.number().min(0).optional(),
});

function withMeta(item: typeof inventoryTable.$inferSelect) {
  const costPrice = Number(item.costPrice);
  const salePrice = Number(item.price);
  const priceAPrazo = Number(item.priceAPrazo ?? 0);
  const profitPerUnit = salePrice - costPrice;
  const marginPct = salePrice > 0 ? (profitPerUnit / salePrice) * 100 : 0;
  const markupPct = costPrice > 0 ? (profitPerUnit / costPrice) * 100 : 0;
  return {
    ...item,
    supplier: item.supplier ?? null,
    costPrice,
    price: salePrice,
    priceAPrazo,
    profitPerUnit,
    marginPct: Math.round(marginPct * 10) / 10,
    markupPct: Math.round(markupPct * 10) / 10,
    totalStockValue: costPrice * item.quantity,
    totalSaleValue: salePrice * item.quantity,
    isLowStock: item.quantity <= item.minQuantity,
    createdAt: item.createdAt.toISOString(),
  };
}

router.get("/inventory", async (req, res) => {
  const tid = getTenantId(req);
  const items = await db.select().from(inventoryTable).where(eq(inventoryTable.tenantId, tid)).orderBy(inventoryTable.name);
  res.json(items.map(withMeta));
});

router.post("/inventory", async (req, res) => {
  const tid = getTenantId(req);
  const body = createInventoryBodySchema.parse(req.body);
  const [item] = await db
    .insert(inventoryTable)
    .values({
      tenantId: tid,
      name: body.name,
      supplier: body.supplier ?? null,
      quantity: body.quantity,
      minQuantity: body.minQuantity ?? 5,
      costPrice: String(body.costPrice ?? 0),
      price: String(body.price ?? 0),
      priceAPrazo: String(body.priceAPrazo ?? 0),
    })
    .returning();
  res.status(201).json(withMeta(item));
});

router.put("/inventory/:id", async (req, res) => {
  const id = Number(req.params.id);
  const tid = getTenantId(req);
  const body = updateInventoryBodySchema.parse(req.body);

  const updateData: Partial<typeof inventoryTable.$inferInsert> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if ("supplier" in body) updateData.supplier = body.supplier ?? null;
  if (body.quantity !== undefined) updateData.quantity = body.quantity;
  if (body.minQuantity !== undefined) updateData.minQuantity = body.minQuantity;
  if (body.costPrice !== undefined) updateData.costPrice = String(body.costPrice);
  if (body.price !== undefined) updateData.price = String(body.price);
  if (body.priceAPrazo !== undefined) updateData.priceAPrazo = String(body.priceAPrazo);

  const [item] = await db.update(inventoryTable).set(updateData).where(and(eq(inventoryTable.id, id), eq(inventoryTable.tenantId, tid))).returning();
  if (!item) { res.status(404).json({ error: "Item not found" }); return; }
  res.json(withMeta(item));
});

router.delete("/inventory/:id", async (req, res) => {
  const id = Number(req.params.id);
  const tid = getTenantId(req);
  await db.delete(inventoryTable).where(and(eq(inventoryTable.id, id), eq(inventoryTable.tenantId, tid)));
  res.status(204).send();
});

export default router;
