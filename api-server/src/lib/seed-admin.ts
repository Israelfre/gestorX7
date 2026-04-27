import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable, tenantsTable } from "@workspace/db";
import { logger } from "./logger";

export async function ensureAdminExists() {
  try {
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.role, "admin"))
      .limit(1);

    if (existing) return;

    logger.info("No admin found — seeding admin user...");

    const [tenant] = await db
      .insert(tenantsTable)
      .values({ name: "GestorX7" })
      .returning();

    const passwordHash = await bcrypt.hash("admin88095152", 10);

    await db.insert(usersTable).values({
      tenantId: tenant.id,
      name: "Admin",
      email: "admin@gestorx7.com",
      passwordHash,
      role: "admin",
      plan: "monthly",
      isActive: true,
    });

    logger.info("Admin user created: admin@gestorx7.com / admin88095152");
  } catch (err) {
    logger.error({ err }, "Failed to seed admin user");
  }
}
