import { eq } from "drizzle-orm";
import { db } from "./client";
import { proofs, responses } from "./schema";
import { hash } from "../crypto";

export async function upsertProof(userId: string, did: string, updates: any) {
  await db
    .insert(proofs)
    .values({ userId: hash(userId).hash, did, ...updates })
    .onConflictDoUpdate({
      target: proofs.userId,
      set: { ...updates, did, updatedAt: new Date() },
    });
}

export async function insertResponse(userId: string, responseId: string) {
  await db.insert(responses).values({ userId: hash(userId).hash, responseId });
}

export async function findProfile(userId: string) {
  return db
    .select()
    .from(proofs)
    .where(eq(proofs.userId, hash(userId).hash))
    .then((r) => r?.[0] ?? null);
}

export async function findResponses(userId: string) {
  return db
    .select()
    .from(responses)
    .where(eq(responses.userId, hash(userId).hash));
}
