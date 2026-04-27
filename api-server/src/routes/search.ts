import { Router } from "express";
import { db, clientsTable, inventoryTable, quotesTable, transactionsTable, employeesTable, salesTable } from "@workspace/db";
import { eq, and, ilike, or } from "drizzle-orm";

const router = Router();

router.get("/search", async (req, res) => {
  const tenantId = req.session.tenantId!;
  const q = String(req.query.q ?? "").trim();

  if (q.length < 2) return res.json({ results: [] });

  const pattern = `%${q}%`;

  const [clients, products, quotes, transactions, employees, sales] = await Promise.all([
    db.select({
      id: clientsTable.id,
      name: clientsTable.name,
      phone: clientsTable.phone,
      email: clientsTable.email,
      isDebtor: clientsTable.isDebtor,
      debtAmount: clientsTable.debtAmount,
    })
    .from(clientsTable)
    .where(and(
      eq(clientsTable.tenantId, tenantId),
      or(
        ilike(clientsTable.name, pattern),
        ilike(clientsTable.phone, pattern),
        ilike(clientsTable.email, pattern),
      )
    ))
    .limit(8),

    db.select({
      id: inventoryTable.id,
      name: inventoryTable.name,
      supplier: inventoryTable.supplier,
      quantity: inventoryTable.quantity,
      price: inventoryTable.price,
    })
    .from(inventoryTable)
    .where(and(
      eq(inventoryTable.tenantId, tenantId),
      or(
        ilike(inventoryTable.name, pattern),
        ilike(inventoryTable.supplier, pattern),
      )
    ))
    .limit(8),

    db.select({
      id: quotesTable.id,
      description: quotesTable.description,
      amount: quotesTable.amount,
      status: quotesTable.status,
      createdAt: quotesTable.createdAt,
    })
    .from(quotesTable)
    .where(and(
      eq(quotesTable.tenantId, tenantId),
      ilike(quotesTable.description, pattern),
    ))
    .limit(6),

    db.select({
      id: transactionsTable.id,
      type: transactionsTable.type,
      description: transactionsTable.description,
      amount: transactionsTable.amount,
      createdAt: transactionsTable.createdAt,
    })
    .from(transactionsTable)
    .where(and(
      eq(transactionsTable.tenantId, tenantId),
      ilike(transactionsTable.description, pattern),
    ))
    .limit(6),

    db.select({
      id: employeesTable.id,
      name: employeesTable.name,
      role: employeesTable.role,
      phone: employeesTable.phone,
      active: employeesTable.active,
    })
    .from(employeesTable)
    .where(and(
      eq(employeesTable.tenantId, tenantId),
      or(
        ilike(employeesTable.name, pattern),
        ilike(employeesTable.role, pattern),
      )
    ))
    .limit(6),

    db.select({
      id: salesTable.id,
      description: salesTable.description,
      clientName: salesTable.clientName,
      amount: salesTable.amount,
      status: salesTable.status,
      createdAt: salesTable.createdAt,
    })
    .from(salesTable)
    .where(and(
      eq(salesTable.tenantId, tenantId),
      or(
        ilike(salesTable.description, pattern),
        ilike(salesTable.clientName, pattern),
      )
    ))
    .limit(6),
  ]);

  const QUOTE_STATUS: Record<string, string> = { pending: "Pendente", converted: "Convertido", rejected: "Recusado" };
  const SALE_STATUS: Record<string, string> = { pendente: "Pendente", pago: "Pago", cancelado: "Cancelado" };

  return res.json({
    results: [
      ...clients.map((c) => ({
        type: "cliente",
        id: c.id,
        title: c.name,
        sub: [c.phone, c.email].filter(Boolean).join(" · "),
        meta: c.isDebtor ? `Devedor: R$ ${Number(c.debtAmount).toFixed(2)}` : null,
        badge: c.isDebtor ? "devedor" : null,
        href: `/clientes/${c.id}`,
      })),
      ...products.map((p) => ({
        type: "produto",
        id: p.id,
        title: p.name,
        sub: p.supplier ? `Fornecedor: ${p.supplier}` : null,
        meta: `Qtd: ${p.quantity} · R$ ${Number(p.price).toFixed(2)}`,
        badge: p.quantity <= 0 ? "sem estoque" : p.quantity <= 5 ? "estoque baixo" : null,
        href: `/estoque`,
      })),
      ...quotes.map((q) => ({
        type: "orçamento",
        id: q.id,
        title: q.description,
        sub: `R$ ${Number(q.amount).toFixed(2)}`,
        meta: QUOTE_STATUS[q.status] ?? q.status,
        badge: null,
        href: `/orcamentos`,
      })),
      ...transactions.map((t) => ({
        type: "financeiro",
        id: t.id,
        title: t.description,
        sub: `${t.type === "income" ? "Entrada" : "Saída"} · R$ ${Number(t.amount).toFixed(2)}`,
        meta: new Date(t.createdAt).toLocaleDateString("pt-BR"),
        badge: null,
        href: `/financeiro`,
      })),
      ...employees.map((e) => ({
        type: "funcionário",
        id: e.id,
        title: e.name,
        sub: [e.role, e.phone].filter(Boolean).join(" · "),
        meta: e.active ? null : "Inativo",
        badge: e.active ? null : "inativo",
        href: `/equipe`,
      })),
      ...sales.map((s) => ({
        type: "venda",
        id: s.id,
        title: s.description,
        sub: s.clientName ?? null,
        meta: `R$ ${Number(s.amount).toFixed(2)} · ${SALE_STATUS[s.status] ?? s.status}`,
        badge: null,
        href: `/vendas`,
      })),
    ],
  });
});

export default router;
