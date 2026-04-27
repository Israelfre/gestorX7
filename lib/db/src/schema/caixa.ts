import { pgTable, serial, integer, numeric, text, timestamp } from "drizzle-orm/pg-core";

export const caixaSessionsTable = pgTable("caixa_sessions", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().default(1),
  openedAt: timestamp("opened_at").notNull().defaultNow(),
  closedAt: timestamp("closed_at"),
  openedBy: integer("opened_by").notNull(),
  closedBy: integer("closed_by"),
  openedByName: text("opened_by_name").notNull().default(""),
  closedByName: text("closed_by_name"),
  initialAmount: numeric("initial_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  finalAmount: numeric("final_amount", { precision: 12, scale: 2 }),
  totalEntradas: numeric("total_entradas", { precision: 12, scale: 2 }),
  totalSaidas: numeric("total_saidas", { precision: 12, scale: 2 }),
  diferenca: numeric("diferenca", { precision: 12, scale: 2 }),
  observations: text("observations"),
  status: text("status").notNull().default("open"),
});

export type CaixaSession = typeof caixaSessionsTable.$inferSelect;
