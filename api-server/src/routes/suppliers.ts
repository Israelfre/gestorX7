import { Router } from "express";
import { eq, asc } from "drizzle-orm";
import { db, suppliersTable } from "@workspace/db";
import { getTenantId } from "../middleware/auth";

const router = Router();

router.get("/suppliers", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const rows = await db
      .select()
      .from(suppliersTable)
      .where(eq(suppliersTable.tenantId, tenantId))
      .orderBy(asc(suppliersTable.name));
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/suppliers", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { name, contactName, phone, email, notes } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: "Nome obrigatório" }); return; }
    const [row] = await db.insert(suppliersTable).values({
      tenantId,
      name: name.trim(),
      contactName: contactName?.trim() || null,
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      notes: notes?.trim() || null,
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.put("/suppliers/:id", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const id = parseInt(req.params.id);
    const { name, contactName, phone, email, notes } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: "Nome obrigatório" }); return; }
    const [row] = await db
      .update(suppliersTable)
      .set({
        name: name.trim(),
        contactName: contactName?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        notes: notes?.trim() || null,
      })
      .where(eq(suppliersTable.id, id))
      .returning();
    if (!row) { res.status(404).json({ error: "Fornecedor não encontrado" }); return; }
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.delete("/suppliers/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(suppliersTable).where(eq(suppliersTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
