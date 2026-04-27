import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, supportTicketsTable } from "@workspace/db";
import { getTenantId } from "../middleware/auth";
import { z } from "zod";

const router = Router();

const ticketSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  status: z.enum(["aberto", "em_andamento", "resolvido"]).default("aberto"),
  priority: z.enum(["baixa", "media", "alta", "urgente"]).default("media"),
  clientId: z.number().int().optional().nullable(),
  clientName: z.string().optional().nullable(),
  assignedTo: z.string().optional().nullable(),
});

function fmt(t: typeof supportTicketsTable.$inferSelect) {
  return {
    ...t,
    createdAt: t.createdAt.toISOString(),
    resolvedAt: t.resolvedAt?.toISOString() ?? null,
  };
}

router.get("/support-tickets", async (req, res) => {
  const tenantId = getTenantId(req);
  const rows = await db.select().from(supportTicketsTable)
    .where(eq(supportTicketsTable.tenantId, tenantId))
    .orderBy(desc(supportTicketsTable.createdAt));
  res.json(rows.map(fmt));
});

router.post("/support-tickets", async (req, res) => {
  const tenantId = getTenantId(req);
  const body = ticketSchema.parse(req.body);
  const [row] = await db.insert(supportTicketsTable).values({
    tenantId,
    title: body.title,
    description: body.description ?? null,
    status: body.status,
    priority: body.priority,
    clientId: body.clientId ?? null,
    clientName: body.clientName ?? null,
    assignedTo: body.assignedTo ?? null,
  }).returning();
  res.status(201).json(fmt(row));
});

router.put("/support-tickets/:id", async (req, res) => {
  const tenantId = getTenantId(req);
  const id = Number(req.params.id);
  const body = ticketSchema.partial().parse(req.body);
  const extra: Partial<typeof body & { resolvedAt: Date | null }> = {};
  if (body.status === "resolvido") extra.resolvedAt = new Date();
  else if (body.status && body.status !== "resolvido") extra.resolvedAt = null;
  const [row] = await db.update(supportTicketsTable)
    .set({ ...body, ...extra })
    .where(and(eq(supportTicketsTable.id, id), eq(supportTicketsTable.tenantId, tenantId)))
    .returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(fmt(row));
});

router.delete("/support-tickets/:id", async (req, res) => {
  const tenantId = getTenantId(req);
  await db.delete(supportTicketsTable)
    .where(and(eq(supportTicketsTable.id, Number(req.params.id)), eq(supportTicketsTable.tenantId, tenantId)));
  res.status(204).send();
});

export default router;
