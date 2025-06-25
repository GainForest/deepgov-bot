import { pgTable, text, timestamp, serial, date } from "drizzle-orm/pg-core";

export const proofs = pgTable("proofs", {
  userId: text("user_id").primaryKey(),
  did: text("did").notNull(),
  gender: text("gender").notNull(),
  dob: date("date_of_birth").notNull(),
  citizenship: text("citizenship").notNull(),
  address1: text("address1").notNull(),
  address2: text("address2").notNull(),
  address3: text("address3").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
