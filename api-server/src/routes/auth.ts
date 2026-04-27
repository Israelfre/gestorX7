import { Router } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, usersTable, tenantsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { getUncachableStripeClient } from "../lib/stripeClient";

const router = Router();

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "E-mail e senha são obrigatórios" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);
    if (!user) {
      res.status(401).json({ error: "E-mail ou senha incorretos" });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ error: "Conta desativada. Contate o administrador." });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "E-mail ou senha incorretos" });
      return;
    }

    req.session.userId = user.id;
    req.session.tenantId = user.tenantId;
    req.session.role = user.role as "admin" | "client";
    req.session.name = user.name;
    req.session.email = user.email;
    req.session.plan = user.plan;
    req.session.planExpiresAt = user.planExpiresAt ? user.planExpiresAt.toISOString() : null;

    // Salva explicitamente antes de responder para garantir persistência no DB
    req.session.save((err) => {
      if (err) {
        console.error("Erro ao salvar sessão:", err);
        res.status(500).json({ error: "Erro ao criar sessão" });
        return;
      }
      res.json({
        sessionId: req.sessionID,
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        plan: user.plan,
        planExpiresAt: user.planExpiresAt,
        tenantId: user.tenantId,
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// POST /api/auth/register — cadastro de novo cliente (após pagamento Stripe)
router.post("/auth/register", async (req, res) => {
  try {
    const { name, email, password, stripeSessionId, planFallback } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ error: "Nome, e-mail e senha são obrigatórios" });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "A senha deve ter ao menos 6 caracteres" });
      return;
    }

    const emailNorm = email.toLowerCase().trim();

    // Verifica se e-mail já existe
    const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, emailNorm)).limit(1);
    if (existing) {
      res.status(409).json({ error: "Este e-mail já possui cadastro. Acesse pelo login." });
      return;
    }

    // Determina plano pelo Stripe session (se fornecido)
    const VALID_PLANS = ["monthly", "semiannual", "yearly"] as const;
    type PaidPlan = typeof VALID_PLANS[number];
    const fallback: PaidPlan = VALID_PLANS.includes(planFallback) ? planFallback as PaidPlan : "monthly";

    let plan: "trial" | "monthly" | "semiannual" | "yearly" = fallback;
    let planExpiresAt: Date | undefined = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
    let stripeCustomerId: string | undefined;
    let stripeSubscriptionId: string | undefined;

    if (stripeSessionId) {
      try {
        const stripe = await getUncachableStripeClient();
        const session = await stripe.checkout.sessions.retrieve(stripeSessionId, { expand: ['subscription'] });
        stripeCustomerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;

        if (session.mode === 'payment') {
          plan = 'monthly';
          planExpiresAt = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
        } else {
          const sub = session.subscription;
          if (sub && typeof sub !== 'string') {
            stripeSubscriptionId = sub.id;
            const priceRecurring = sub.items.data[0]?.price?.recurring;
            const priceMetadata = sub.items.data[0]?.price?.metadata as Record<string, string> | undefined;
            const interval = priceRecurring?.interval;
            const count = priceRecurring?.interval_count ?? 1;
            const planType = priceMetadata?.plan_type;
            if (planType === 'semiannual' || (interval === 'month' && count === 6)) { plan = 'semiannual'; planExpiresAt = new Date(Date.now() + 183 * 24 * 60 * 60 * 1000); }
            else if (interval === 'year') { plan = 'yearly'; planExpiresAt = new Date(Date.now() + 366 * 24 * 60 * 60 * 1000); }
            else { plan = 'monthly'; planExpiresAt = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000); }
          }
        }
      } catch (stripeErr) {
        console.error("Stripe session lookup failed, using planFallback:", stripeErr);
      }
    }

    // Cria tenant e usuário
    const passwordHash = await bcrypt.hash(password, 10);
    const [tenant] = await db.insert(tenantsTable).values({ name: name.trim() }).returning();
    const [user] = await db
      .insert(usersTable)
      .values({
        tenantId: tenant.id,
        name: name.trim(),
        email: emailNorm,
        passwordHash,
        role: "client",
        plan,
        planExpiresAt,
        isActive: true,
        stripeCustomerId,
        stripeSubscriptionId,
      })
      .returning();

    res.status(201).json({ ok: true, user: { id: user.id, name: user.name, email: user.email, plan: user.plan } });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Erro ao criar conta. Tente novamente." });
  }
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("gx7.sid");
    res.json({ ok: true });
  });
});

router.get("/auth/me", requireAuth, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  const s = req.session;
  const planExpired =
    s.role !== "admin" &&
    s.plan !== "free" &&
    s.planExpiresAt != null &&
    new Date(s.planExpiresAt) < new Date();

  res.json({
    id: s.userId,
    name: s.name,
    email: s.email,
    role: s.role,
    plan: s.plan,
    planExpiresAt: s.planExpiresAt,
    tenantId: s.tenantId,
    planExpired,
  });
});

export default router;
