import { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }

  const plan = req.session.plan;
  const expiresAt = req.session.planExpiresAt;
  const role = req.session.role;

  if (role !== "admin" && plan !== "free") {
    if (expiresAt) {
      // Compara apenas datas (sem hora) para que o plano expire no FIM do dia (UTC)
      const expiryDate = new Date(expiresAt);
      expiryDate.setUTCHours(23, 59, 59, 999);
      if (expiryDate < new Date()) {
        res.status(403).json({ error: "Plano expirado. Renove sua assinatura." });
        return;
      }
    }
  }

  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  if (req.session.role !== "admin") {
    res.status(403).json({ error: "Acesso negado" });
    return;
  }
  next();
}

export function getTenantId(req: Request): number {
  return req.session?.tenantId ?? 1;
}
