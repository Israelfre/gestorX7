import { Router } from "express";
import { eq, ne, asc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, usersTable, tenantsTable } from "@workspace/db";
import { requireAdmin } from "../middleware/auth";

const router = Router();

router.use(requireAdmin);

function formatUser(u: typeof usersTable.$inferSelect) {
  const now = new Date();
  const expiresAt = u.planExpiresAt;
  const daysLeft = expiresAt ? Math.ceil((expiresAt.getTime() - now.getTime()) / 86400000) : null;

  return {
    id: u.id,
    tenantId: u.tenantId,
    name: u.name,
    email: u.email,
    phone: u.phone ?? null,
    passwordPlain: u.passwordPlain ?? null,
    role: u.role,
    plan: u.plan,
    planExpiresAt: expiresAt ? expiresAt.toISOString() : null,
    isActive: u.isActive,
    daysLeft,
    status: !u.isActive
      ? "inativo"
      : u.plan === "free"
        ? "gratuito"
        : daysLeft == null
          ? "ativo"
          : daysLeft <= 0
            ? "expirado"
            : daysLeft <= 7
              ? "vencendo"
              : "ativo",
    createdAt: u.createdAt.toISOString(),
  };
}

// List all non-admin users
router.get("/users", async (req, res) => {
  try {
    const users = await db
      .select()
      .from(usersTable)
      .orderBy(asc(usersTable.createdAt));
    res.json(users.map(formatUser));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Get single user
router.get("/users/:id", async (req, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, parseInt(req.params.id))).limit(1);
    if (!user) { res.status(404).json({ error: "Usuário não encontrado" }); return; }
    res.json(formatUser(user));
  } catch (err) {
    res.status(500).json({ error: "Erro interno" });
  }
});

// Create client user + tenant
router.post("/users", async (req, res) => {
  try {
    const { name, email, phone, password, plan, planExpiresAt, isActive } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios" });
      return;
    }

    const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    if (existing.length > 0) {
      res.status(400).json({ error: "Este e-mail já está cadastrado" });
      return;
    }

    // Create isolated tenant for this client
    const [tenant] = await db.insert(tenantsTable).values({ name }).returning();

    const hash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(usersTable).values({
      tenantId: tenant.id,
      name,
      email: email.toLowerCase().trim(),
      phone: phone ?? null,
      passwordHash: hash,
      passwordPlain: password,
      role: "client",
      plan: plan ?? "trial",
      planExpiresAt: planExpiresAt ? new Date(planExpiresAt) : null,
      isActive: isActive !== false,
    }).returning();

    res.status(201).json(formatUser(user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Update user
router.put("/users/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, email, phone, password, plan, planExpiresAt, isActive } = req.body;

    const updates: Partial<typeof usersTable.$inferInsert> = {};
    if (name) updates.name = name;
    if (email) updates.email = email.toLowerCase().trim();
    if (phone !== undefined) updates.phone = phone || null;
    if (plan) updates.plan = plan;
    if (planExpiresAt !== undefined) updates.planExpiresAt = planExpiresAt ? new Date(planExpiresAt) : null;
    if (isActive !== undefined) updates.isActive = isActive;
    if (password) {
      updates.passwordHash = await bcrypt.hash(password, 10);
      updates.passwordPlain = password;
    }

    const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
    if (!user) { res.status(404).json({ error: "Usuário não encontrado" }); return; }
    res.json(formatUser(user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Delete user
router.delete("/users/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(usersTable).where(eq(usersTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
