import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, tasksTable, clientsTable } from "@workspace/db";
import { getTenantId } from "../middleware/auth";
import { z } from "zod";

const router = Router();

const createTaskBodySchema = z.object({
  title: z.string().min(1),
  clientId: z.number().optional(),
  dueDate: z.string().min(1),
  status: z.enum(["pending", "completed"]).optional().default("pending"),
});

const updateTaskBodySchema = z.object({
  title: z.string().min(1).optional(),
  clientId: z.number().optional().nullable(),
  dueDate: z.string().optional(),
  status: z.enum(["pending", "completed"]).optional(),
});

function taskWithMeta(t: typeof tasksTable.$inferSelect, allClientMap: Record<number, string>) {
  const today = new Date().toISOString().split("T")[0];
  return {
    ...t,
    clientName: t.clientId ? allClientMap[t.clientId] ?? null : null,
    isOverdue: t.status === "pending" && t.dueDate < today,
    createdAt: t.createdAt.toISOString(),
  };
}

async function getClientMap(tenantId: number) {
  const allClients = await db.select().from(clientsTable).where(eq(clientsTable.tenantId, tenantId));
  const map: Record<number, string> = {};
  allClients.forEach((c) => { map[c.id] = c.name; });
  return map;
}

router.get("/tasks", async (req, res) => {
  const tid = getTenantId(req);
  const tasks = await db.select().from(tasksTable).where(eq(tasksTable.tenantId, tid)).orderBy(tasksTable.dueDate);
  const map = await getClientMap(tid);
  res.json(tasks.map((t) => taskWithMeta(t, map)));
});

router.post("/tasks", async (req, res) => {
  const tid = getTenantId(req);
  const body = createTaskBodySchema.parse(req.body);
  const [task] = await db.insert(tasksTable).values({
    tenantId: tid,
    title: body.title,
    clientId: body.clientId ?? null,
    dueDate: body.dueDate,
    status: body.status ?? "pending",
  }).returning();

  const map = await getClientMap(tid);
  res.status(201).json(taskWithMeta(task, map));
});

router.put("/tasks/:id", async (req, res) => {
  const id = Number(req.params.id);
  const tid = getTenantId(req);
  const body = updateTaskBodySchema.parse(req.body);

  const updateData: Partial<typeof tasksTable.$inferInsert> = {};
  if (body.title !== undefined) updateData.title = body.title;
  if (body.clientId !== undefined) updateData.clientId = body.clientId;
  if (body.dueDate !== undefined) updateData.dueDate = body.dueDate;
  if (body.status !== undefined) updateData.status = body.status;

  const [task] = await db.update(tasksTable).set(updateData).where(and(eq(tasksTable.id, id), eq(tasksTable.tenantId, tid))).returning();
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }

  const map = await getClientMap(tid);
  res.json(taskWithMeta(task, map));
});

router.delete("/tasks/:id", async (req, res) => {
  const id = Number(req.params.id);
  const tid = getTenantId(req);
  await db.delete(tasksTable).where(and(eq(tasksTable.id, id), eq(tasksTable.tenantId, tid)));
  res.status(204).send();
});

export default router;
