import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { employeesTable } from "./employees";

export const employeeSchedulesTable = pgTable("employee_schedules", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().default(1),
  employeeId: integer("employee_id").notNull().references(() => employeesTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  startTime: text("start_time").notNull().default("08:00"),
  endTime: text("end_time").notNull().default("17:00"),
  status: text("status").notNull().default("presente"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type EmployeeSchedule = typeof employeeSchedulesTable.$inferSelect;
