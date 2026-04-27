import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const companySettingsTable = pgTable("company_settings", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().default(1),
  name: text("name").notNull().default(""),
  personType: text("person_type").notNull().default("PJ"), // 'PF' | 'PJ'
  cnpj: text("cnpj").notNull().default(""),
  cpf: text("cpf").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  address: text("address").notNull().default(""),
  city: text("city").notNull().default(""),
  logoUrl: text("logo_url").notNull().default(""),
});

export const insertCompanySettingsSchema = createInsertSchema(companySettingsTable).omit({ id: true });
export type InsertCompanySettings = z.infer<typeof insertCompanySettingsSchema>;
export type CompanySettings = typeof companySettingsTable.$inferSelect;
