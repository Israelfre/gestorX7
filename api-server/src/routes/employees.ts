import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, employeesTable, salesTable, employeeSchedulesTable, deliveriesTable, productSalesTable, transactionsTable } from "@workspace/db";
import { getTenantId } from "../middleware/auth";
import { z } from "zod";

const router = Router();

const employeeSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  phone: z.string().default(""),
  commissionRate: z.number().min(0).max(100).default(0),
  commissionPeriod: z.enum(["mensal", "semanal", "quinzenal"]).default("mensal"),
  commissionLimit: z.number().min(0).optional().nullable(),
  active: z.boolean().default(true),
});

const saleSchema = z.object({
  employeeId: z.number().int(),
  clientId: z.number().int().optional().nullable(),
  clientName: z.string().optional().nullable(),
  description: z.string().min(1),
  amount: z.number().positive(),
  commissionPct: z.number().min(0).max(100).optional(),
  status: z.enum(["pendente", "pago"]).default("pendente"),
});

const scheduleSchema = z.object({
  employeeId: z.number().int(),
  date: z.string(),
  startTime: z.string().default(""),
  endTime: z.string().default(""),
  status: z.enum(["presente", "falta", "atestado", "folga"]).default("presente"),
  notes: z.string().optional().nullable(),
});

const deliverySchema = z.object({
  title: z.string().min(1),
  clientId: z.number().int().optional().nullable(),
  clientName: z.string().optional().nullable(),
  employeeId: z.number().int().optional().nullable(),
  employeeName: z.string().optional().nullable(),
  status: z.enum(["pendente", "em_rota", "entregue", "problema"]).default("pendente"),
  deliveryDate: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

function formatEmployee(e: typeof employeesTable.$inferSelect) {
  return { ...e, commissionRate: Number(e.commissionRate), commissionLimit: e.commissionLimit != null ? Number(e.commissionLimit) : null };
}

// ─── Employees CRUD ───────────────────────────────────────────────
router.get("/employees", async (req, res) => {
  const tid = getTenantId(req);
  const employees = await db.select().from(employeesTable).where(eq(employeesTable.tenantId, tid)).orderBy(employeesTable.name);
  res.json(employees.map(formatEmployee));
});

router.post("/employees", async (req, res) => {
  const tid = getTenantId(req);
  const body = employeeSchema.parse(req.body);
  const [emp] = await db.insert(employeesTable).values({
    tenantId: tid,
    ...body,
    commissionRate: String(body.commissionRate),
    commissionLimit: body.commissionLimit != null ? String(body.commissionLimit) : null,
  }).returning();
  res.status(201).json(formatEmployee(emp));
});

router.put("/employees/:id", async (req, res) => {
  const id = Number(req.params.id);
  const tid = getTenantId(req);
  const body = employeeSchema.parse(req.body);
  const [emp] = await db.update(employeesTable).set({
    ...body,
    commissionRate: String(body.commissionRate),
    commissionLimit: body.commissionLimit != null ? String(body.commissionLimit) : null,
  }).where(and(eq(employeesTable.id, id), eq(employeesTable.tenantId, tid))).returning();
  if (!emp) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatEmployee(emp));
});

router.delete("/employees/:id", async (req, res) => {
  const id = Number(req.params.id);
  const tid = getTenantId(req);
  await db.delete(employeesTable).where(and(eq(employeesTable.id, id), eq(employeesTable.tenantId, tid)));
  res.status(204).send();
});

// ─── Sales CRUD ───────────────────────────────────────────────────
router.get("/sales", async (req, res) => {
  const tid = getTenantId(req);
  const rows = await db.select().from(salesTable).where(eq(salesTable.tenantId, tid)).orderBy(desc(salesTable.createdAt));
  res.json(rows.map((s) => ({ ...s, amount: Number(s.amount), commissionPct: Number(s.commissionPct), commissionAmount: Number(s.commissionAmount), createdAt: s.createdAt.toISOString() })));
});

router.post("/sales", async (req, res) => {
  const tid = getTenantId(req);
  const body = saleSchema.parse(req.body);
  const emp = await db.select().from(employeesTable).where(and(eq(employeesTable.id, body.employeeId), eq(employeesTable.tenantId, tid)));
  const pct = body.commissionPct ?? Number(emp[0]?.commissionRate ?? 0);
  const commAmt = (body.amount * pct) / 100;
  const [row] = await db.insert(salesTable).values({
    tenantId: tid,
    employeeId: body.employeeId,
    clientId: body.clientId ?? null,
    clientName: body.clientName ?? null,
    description: body.description,
    amount: String(body.amount),
    commissionPct: String(pct),
    commissionAmount: String(commAmt),
    status: body.status,
  }).returning();
  res.status(201).json({ ...row, amount: Number(row.amount), commissionPct: Number(row.commissionPct), commissionAmount: Number(row.commissionAmount), createdAt: row.createdAt.toISOString() });
});

router.put("/sales/:id", async (req, res) => {
  const id = Number(req.params.id);
  const tid = getTenantId(req);
  const body = z.object({ status: z.enum(["pendente", "pago"]) }).parse(req.body);
  const [row] = await db.update(salesTable).set({ status: body.status }).where(and(eq(salesTable.id, id), eq(salesTable.tenantId, tid))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...row, amount: Number(row.amount), commissionPct: Number(row.commissionPct), commissionAmount: Number(row.commissionAmount), createdAt: row.createdAt.toISOString() });
});

router.delete("/sales/:id", async (req, res) => {
  const tid = getTenantId(req);
  await db.delete(salesTable).where(and(eq(salesTable.id, Number(req.params.id)), eq(salesTable.tenantId, tid)));
  res.status(204).send();
});

// ─── Schedules CRUD ───────────────────────────────────────────────
router.get("/schedules", async (req, res) => {
  const tid = getTenantId(req);
  const { date } = req.query;
  const rows = date
    ? await db.select().from(employeeSchedulesTable).where(and(eq(employeeSchedulesTable.tenantId, tid), eq(employeeSchedulesTable.date, String(date))))
    : await db.select().from(employeeSchedulesTable).where(eq(employeeSchedulesTable.tenantId, tid)).orderBy(desc(employeeSchedulesTable.date));
  res.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

router.post("/schedules", async (req, res) => {
  const tid = getTenantId(req);
  const body = scheduleSchema.parse(req.body);
  const [row] = await db.insert(employeeSchedulesTable).values({ tenantId: tid, ...body, notes: body.notes ?? null }).returning();
  res.status(201).json({ ...row, createdAt: row.createdAt.toISOString() });
});

router.put("/schedules/:id", async (req, res) => {
  const id = Number(req.params.id);
  const tid = getTenantId(req);
  const body = scheduleSchema.partial().parse(req.body);
  const [row] = await db.update(employeeSchedulesTable).set(body).where(and(eq(employeeSchedulesTable.id, id), eq(employeeSchedulesTable.tenantId, tid))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...row, createdAt: row.createdAt.toISOString() });
});

router.delete("/schedules/:id", async (req, res) => {
  const tid = getTenantId(req);
  await db.delete(employeeSchedulesTable).where(and(eq(employeeSchedulesTable.id, Number(req.params.id)), eq(employeeSchedulesTable.tenantId, tid)));
  res.status(204).send();
});

// ─── Deliveries CRUD ──────────────────────────────────────────────
router.get("/deliveries", async (req, res) => {
  const tid = getTenantId(req);
  const rows = await db.select().from(deliveriesTable).where(eq(deliveriesTable.tenantId, tid)).orderBy(desc(deliveriesTable.createdAt));
  res.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

router.post("/deliveries", async (req, res) => {
  const tid = getTenantId(req);
  const body = deliverySchema.parse(req.body);
  const [row] = await db.insert(deliveriesTable).values({ tenantId: tid, ...body }).returning();
  res.status(201).json({ ...row, createdAt: row.createdAt.toISOString() });
});

router.put("/deliveries/:id", async (req, res) => {
  const id = Number(req.params.id);
  const tid = getTenantId(req);
  const body = deliverySchema.partial().parse(req.body);
  const [row] = await db.update(deliveriesTable).set(body).where(and(eq(deliveriesTable.id, id), eq(deliveriesTable.tenantId, tid))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...row, createdAt: row.createdAt.toISOString() });
});

router.delete("/deliveries/:id", async (req, res) => {
  const tid = getTenantId(req);
  await db.delete(deliveriesTable).where(and(eq(deliveriesTable.id, Number(req.params.id)), eq(deliveriesTable.tenantId, tid)));
  res.status(204).send();
});

// ─── Resumo Diário ────────────────────────────────────────────────
router.get("/resumo-diario", async (req, res) => {
  const tid = getTenantId(req);
  const today = new Date().toISOString().split("T")[0];

  const [allSales, todaySched, todayDeliveries, allEmployees, allProductSales, allTransactions] = await Promise.all([
    db.select().from(salesTable).where(eq(salesTable.tenantId, tid)).orderBy(desc(salesTable.createdAt)),
    db.select().from(employeeSchedulesTable).where(and(eq(employeeSchedulesTable.tenantId, tid), eq(employeeSchedulesTable.date, today))),
    db.select().from(deliveriesTable).where(eq(deliveriesTable.tenantId, tid)),
    db.select().from(employeesTable).where(and(eq(employeesTable.tenantId, tid), eq(employeesTable.active, true))),
    db.select().from(productSalesTable).where(eq(productSalesTable.tenantId, tid)).orderBy(desc(productSalesTable.createdAt)),
    db.select().from(transactionsTable).where(eq(transactionsTable.tenantId, tid)).orderBy(desc(transactionsTable.createdAt)),
  ]);

  const todaySales = allSales.filter((s) => s.createdAt.toISOString().split("T")[0] === today);
  const totalVendasHoje = todaySales.reduce((s, v) => s + Number(v.amount), 0);
  const totalComissaoHoje = todaySales.reduce((s, v) => s + Number(v.commissionAmount), 0);
  const pendingSales = allSales.filter((s) => s.status === "pendente");
  const totalComissaoPendente = pendingSales.reduce((s, v) => s + Number(v.commissionAmount), 0);

  const entregasPendentes = todayDeliveries.filter((d) => d.status === "pendente").length;
  const entregasEmRota = todayDeliveries.filter((d) => d.status === "em_rota").length;
  const entregasEntregues = todayDeliveries.filter((d) => d.status === "entregue").length;
  const entregasProblema = todayDeliveries.filter((d) => d.status === "problema").length;

  const presentes = todaySched.filter((s) => s.status === "presente").length;
  const faltas = todaySched.filter((s) => s.status === "falta").length;

  const empSalesToday = todaySales.reduce((acc, s) => {
    const id = s.employeeId;
    if (!acc[id]) acc[id] = { amount: 0, count: 0 };
    acc[id].amount += Number(s.amount);
    acc[id].count++;
    return acc;
  }, {} as Record<number, { amount: number; count: number }>);

  const topEmployee = Object.entries(empSalesToday).sort((a, b) => b[1].amount - a[1].amount)[0];
  let topEmployeeName = null;
  if (topEmployee) {
    const emp = allEmployees.find((e) => e.id === Number(topEmployee[0]));
    topEmployeeName = emp?.name ?? null;
  }

  const todayProductSales = allProductSales.filter((s) => s.createdAt.toISOString().split("T")[0] === today);
  const totalProdVendas = todayProductSales.reduce((s, v) => s + Number(v.total), 0);
  const recentProductSales = todayProductSales.slice(0, 10).map((s) => ({
    id: s.id,
    clientName: s.clientName,
    total: Number(s.total),
    paymentMethod: s.paymentMethod,
    paymentType: s.paymentType,
    items: (() => { try { return JSON.parse(s.items) as { name: string; quantity: number; unitPrice: number }[]; } catch { return []; } })(),
    returnTotal: s.returnTotal ? Number(s.returnTotal) : null,
    createdAt: s.createdAt.toISOString(),
  }));

  const todayTransactions = allTransactions.filter((t) => t.createdAt.toISOString().split("T")[0] === today);
  const totalEntradas = todayTransactions.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const totalSaidas = todayTransactions.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const recentTransactions = todayTransactions.slice(0, 10).map((t) => ({
    id: t.id,
    type: t.type,
    amount: Number(t.amount),
    description: t.description,
    createdAt: t.createdAt.toISOString(),
  }));

  res.json({
    date: today,
    vendas: { total: totalVendasHoje, count: todaySales.length, comissao: totalComissaoHoje },
    comissoesPendentes: totalComissaoPendente,
    funcionarios: { total: allEmployees.length, presentes, faltas },
    entregas: { pendentes: entregasPendentes, emRota: entregasEmRota, entregues: entregasEntregues, problema: entregasProblema, total: todayDeliveries.length },
    topEmployee: topEmployeeName,
    recentSales: todaySales.slice(0, 5).map((s) => ({ ...s, amount: Number(s.amount), commissionAmount: Number(s.commissionAmount), createdAt: s.createdAt.toISOString() })),
    prodVendas: { total: totalProdVendas, count: todayProductSales.length, items: recentProductSales },
    movimentacoes: { entradas: totalEntradas, saidas: totalSaidas, saldo: totalEntradas - totalSaidas, items: recentTransactions },
  });
});

export default router;
