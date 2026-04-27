import { Router } from "express";
import { eq, and, gte, lte, isNotNull, inArray, desc } from "drizzle-orm";
import { db, productSalesTable, employeesTable, quotesTable, clientsTable, commissionPaymentsTable } from "@workspace/db";
import { getTenantId } from "../middleware/auth";
import { z } from "zod";

const router = Router();

function getPeriodRange(period: string, reference: string): { start: Date; end: Date } {
  const ref = reference ? new Date(reference) : new Date();
  if (period === "semanal") {
    const day = ref.getDay();
    const start = new Date(ref); start.setDate(ref.getDate() - day); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (period === "quinzenal") {
    const d = ref.getDate();
    const start = new Date(ref); const end = new Date(ref);
    if (d <= 15) { start.setDate(1); end.setDate(15); } else { start.setDate(16); end.setDate(new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate()); }
    start.setHours(0, 0, 0, 0); end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function periodLabel(period: string, start: Date, end: Date): string {
  const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return period === "mensal" ? start.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : `${fmt(start)} – ${fmt(end)}`;
}

router.get("/commissions/summary", async (req, res) => {
  try {
    const tid = getTenantId(req);
    const refDate = (req.query["date"] as string) || new Date().toISOString();
    const employees = await db.select().from(employeesTable).where(and(eq(employeesTable.active, true), eq(employeesTable.tenantId, tid)));

    const results = await Promise.all(employees.map(async (emp) => {
      const period = emp.commissionPeriod ?? "mensal";
      const { start, end } = getPeriodRange(period, refDate);
      const label = periodLabel(period, start, end);

      // ── Vendas do módulo Vendas (productSales) ─────────────────
      const sales = await db.select().from(productSalesTable).where(
        and(
          eq(productSalesTable.employeeId, emp.id),
          eq(productSalesTable.tenantId, tid),
          isNotNull(productSalesTable.commissionPct),
          gte(productSalesTable.createdAt, start),
          lte(productSalesTable.createdAt, end),
        )
      );

      // ── Orçamentos convertidos em venda (quotes) ───────────────
      const convertedQuotes = await db.select().from(quotesTable).where(
        and(
          eq(quotesTable.employeeId, emp.id),
          eq(quotesTable.tenantId, tid),
          eq(quotesTable.status, "converted"),
          gte(quotesTable.createdAt, start),
          lte(quotesTable.createdAt, end),
        )
      );

      let grossCommission = 0, paidCommission = 0, totalSalesAmount = 0;
      const limit = emp.commissionLimit ? Number(emp.commissionLimit) : null;

      const salesDetail = sales.map((s) => {
        const saleTotal = Number(s.total);
        const pct = Number(s.commissionPct ?? 0);
        const rawComm = (saleTotal * pct) / 100;
        totalSalesAmount += saleTotal;
        return { ...s, commissionAmount: rawComm };
      });
      salesDetail.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      // Busca clientes que JÁ tiveram a dívida quitada (isDebtor = false)
      // Para vendas a prazo: se o cliente não é mais devedor → comissão liberada
      const aprazoClientIds = [...new Set(salesDetail.filter(s => s.paymentType === "aprazo" && !s.commissionPaid && s.clientId).map(s => s.clientId!))];
      const settledClientIds = new Set<number>();
      if (aprazoClientIds.length > 0) {
        const clientRecords = await db.select({ id: clientsTable.id, isDebtor: clientsTable.isDebtor })
          .from(clientsTable).where(inArray(clientsTable.id, aprazoClientIds));
        clientRecords.forEach(c => { if (!c.isDebtor) settledClientIds.add(c.id); });
      }

      let accumulatedComm = 0;
      let releasedCommission = 0; // à vista + commissionPaid===false → liberada para pagar ao vendedor
      let blockedCommission = 0;  // a prazo → bloqueada até cliente pagar
      const salesWithCappedComm = salesDetail.map((s) => {
        let comm = s.commissionAmount;
        if (limit !== null) { const remaining = Math.max(0, limit - accumulatedComm); comm = Math.min(comm, remaining); }
        accumulatedComm += comm;
        grossCommission += comm;
        // Venda é "liberada" se: à vista, OU a prazo mas cliente já quitou a dívida
        const clientQuitou = s.clientId ? settledClientIds.has(s.clientId) : false;
        const effectivelyPaid = s.paymentType === "avista" || clientQuitou;
        if (s.commissionPaid) {
          paidCommission += comm;
        } else {
          if (effectivelyPaid) { releasedCommission += comm; }
          else { blockedCommission += comm; }
        }
        return {
          id: s.id, createdAt: s.createdAt, total: Number(s.total),
          commissionPct: Number(s.commissionPct), commissionAmount: comm,
          commissionPaid: s.commissionPaid, commissionPaidAt: s.commissionPaidAt,
          clientName: s.clientName,
          // Se cliente quitou a dívida, retorna "avista" para UI mostrar liberada
          paymentType: effectivelyPaid ? "avista" : (s.paymentType ?? "avista"),
          source: "venda" as const,
          items: (() => { try { return JSON.parse(s.items); } catch { return []; } })(),
        };
      });

      // Comissões de orçamentos convertidos (não têm commissionPaid ainda — tratado como pendente)
      let quotesCommission = 0;
      const quotesDetail = convertedQuotes
        .filter((q) => Number(q.commissionAmount ?? 0) > 0)
        .map((q) => {
          let comm = Number(q.commissionAmount ?? 0);
          if (limit !== null) { const remaining = Math.max(0, limit - accumulatedComm); comm = Math.min(comm, remaining); }
          accumulatedComm += comm;
          grossCommission += comm;
          quotesCommission += comm;
          blockedCommission += comm; // orçamentos sempre bloqueados (A Prazo por natureza)
          totalSalesAmount += Number(q.amount ?? 0);
          return {
            id: q.id, createdAt: q.createdAt, total: Number(q.amount ?? 0),
            commissionPct: Number(q.commissionPct ?? 0), commissionAmount: comm,
            commissionPaid: false, commissionPaidAt: null,
            clientName: q.clientName ?? null,
            paymentType: "aprazo" as const,
            source: "orcamento" as const,
            items: [],
          };
        });

      const pendingCommission = grossCommission - paidCommission;

      return {
        employee: { id: emp.id, name: emp.name, role: emp.role, commissionRate: Number(emp.commissionRate), commissionPeriod: period, commissionLimit: limit },
        period: { label, start: start.toISOString(), end: end.toISOString() },
        totalSalesAmount,
        totalSalesCount: sales.length + convertedQuotes.length,
        grossCommission,
        paidCommission,
        pendingCommission,
        releasedCommission,  // liberada para pagar ao vendedor (vendas à vista)
        blockedCommission,   // bloqueada — aguardando cliente pagar (a prazo)
        quotesCommission,
        limitReached: limit !== null && accumulatedComm >= limit,
        limitPct: limit !== null ? Math.min(100, (accumulatedComm / limit) * 100) : null,
        sales: [...salesWithCappedComm, ...quotesDetail].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      };
    }));

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao calcular comissões" });
  }
});

const paySchema = z.object({ saleIds: z.array(z.number().int().positive()).min(1) });

router.put("/commissions/pay", async (req, res) => {
  try {
    const { saleIds } = paySchema.parse(req.body);
    const now = new Date();
    await db.update(productSalesTable).set({ commissionPaid: true, commissionPaidAt: now }).where(inArray(productSalesTable.id, saleIds));
    res.json({ ok: true, paidAt: now.toISOString() });
  } catch (err) {
    res.status(400).json({ error: "Erro ao marcar comissões como pagas" });
  }
});

router.put("/commissions/unpay", async (req, res) => {
  try {
    const { saleIds } = paySchema.parse(req.body);
    await db.update(productSalesTable).set({ commissionPaid: false, commissionPaidAt: null }).where(inArray(productSalesTable.id, saleIds));
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: "Erro" });
  }
});

// ── Partial Commission Payments ─────────────────────────────────────────────

const partialPaySchema = z.object({
  employeeId: z.number().int().positive(),
  amount: z.number().positive(),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
  referenceMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

router.get("/commissions/partial-payments", async (req, res) => {
  try {
    const tid = getTenantId(req);
    const empId = req.query["employeeId"] ? Number(req.query["employeeId"]) : undefined;
    const conditions = [eq(commissionPaymentsTable.tenantId, tid)];
    if (empId) conditions.push(eq(commissionPaymentsTable.employeeId, empId));
    const payments = await db.select().from(commissionPaymentsTable)
      .where(and(...conditions))
      .orderBy(desc(commissionPaymentsTable.paidAt));
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar pagamentos" });
  }
});

router.post("/commissions/partial-payments", async (req, res) => {
  try {
    const tid = getTenantId(req);
    const data = partialPaySchema.parse(req.body);
    const [row] = await db.insert(commissionPaymentsTable).values({
      tenantId: tid,
      employeeId: data.employeeId,
      amount: String(data.amount),
      paidAt: data.paidAt,
      notes: data.notes ?? null,
      referenceMonth: data.referenceMonth ?? data.paidAt.slice(0, 7),
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    res.status(400).json({ error: "Dados inválidos" });
  }
});

router.delete("/commissions/partial-payments/:id", async (req, res) => {
  try {
    const tid = getTenantId(req);
    const id = Number(req.params["id"]);
    await db.delete(commissionPaymentsTable)
      .where(and(eq(commissionPaymentsTable.id, id), eq(commissionPaymentsTable.tenantId, tid)));
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: "Erro ao deletar" });
  }
});

// ── Monthly earnings per employee ───────────────────────────────────────────

router.get("/commissions/monthly-earnings", async (req, res) => {
  try {
    const tid = getTenantId(req);
    const payments = await db.select().from(commissionPaymentsTable)
      .where(eq(commissionPaymentsTable.tenantId, tid))
      .orderBy(desc(commissionPaymentsTable.paidAt));

    // Group by employeeId + referenceMonth
    const map: Record<string, { employeeId: number; month: string; total: number; count: number }> = {};
    for (const p of payments) {
      const month = p.referenceMonth ?? p.paidAt.slice(0, 7);
      const key = `${p.employeeId}-${month}`;
      if (!map[key]) map[key] = { employeeId: p.employeeId, month, total: 0, count: 0 };
      map[key].total += Number(p.amount);
      map[key].count += 1;
    }
    res.json(Object.values(map).sort((a, b) => b.month.localeCompare(a.month)));
  } catch (err) {
    res.status(500).json({ error: "Erro" });
  }
});

export default router;
