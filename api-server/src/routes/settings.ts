import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, companySettingsTable } from "@workspace/db";
import { getTenantId } from "../middleware/auth";
import { z } from "zod";

const router = Router();

const settingsSchema = z.object({
  name: z.string().default(""),
  personType: z.enum(["PF", "PJ"]).default("PJ"),
  cnpj: z.string().default(""),
  cpf: z.string().default(""),
  phone: z.string().default(""),
  email: z.string().default(""),
  address: z.string().default(""),
  city: z.string().default(""),
  logoUrl: z.string().default(""),
});

router.get("/settings", async (req, res) => {
  try {
    const tid = getTenantId(req);
    const rows = await db.select().from(companySettingsTable).where(eq(companySettingsTable.tenantId, tid)).limit(1);
    if (rows.length > 0) { res.json(rows[0]); return; }
    const [created] = await db.insert(companySettingsTable).values({ tenantId: tid }).returning();
    res.json(created);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put("/settings", async (req, res) => {
  try {
    const tid = getTenantId(req);
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error }); return; }

    const rows = await db.select().from(companySettingsTable).where(eq(companySettingsTable.tenantId, tid)).limit(1);
    if (rows.length === 0) {
      const [created] = await db.insert(companySettingsTable).values({ tenantId: tid, ...parsed.data }).returning();
      res.json(created); return;
    }
    const [updated] = await db.update(companySettingsTable).set(parsed.data).where(and(eq(companySettingsTable.id, rows[0].id), eq(companySettingsTable.tenantId, tid))).returning();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
