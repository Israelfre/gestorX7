import { pgTable, serial, text, boolean, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clientsTable = pgTable("clients", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().default(1),
  name: text("name").notNull(),
  fantasia: text("fantasia"),
  personType: text("person_type").notNull().default("PF"), // 'PF' | 'PJ'
  cnpj: text("cnpj").notNull().default(""),
  phone: text("phone").notNull(),
  email: text("email"),
  notes: text("notes"),
  isDebtor: boolean("is_debtor").notNull().default(false),
  debtAmount: numeric("debt_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  debtPaidAmount: numeric("debt_paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  debtDueDate: text("debt_due_date"),
  cep: text("cep"),
  logradouro: text("logradouro"),
  numero: text("numero"),
  complemento: text("complemento"),
  bairro: text("bairro"),
  cidade: text("cidade"),
  estado: text("estado"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertClientSchema = createInsertSchema(clientsTable).omit({ id: true, createdAt: true, tenantId: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clientsTable.$inferSelect;
