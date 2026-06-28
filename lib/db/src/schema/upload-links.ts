import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { vendorsTable } from "./vendors";

export const uploadLinksTable = pgTable("upload_links", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  vendorId: integer("vendor_id")
    .notNull()
    .references(() => vendorsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

export type UploadLink = typeof uploadLinksTable.$inferSelect;
