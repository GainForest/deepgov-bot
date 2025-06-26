import { eq } from "drizzle-orm";
import { db } from "./client";
import { proofs, responses } from "./schema";

export async function upsertProof(userId: string, did: string, updates: any) {
  await db
    .insert(proofs)
    .values({ userId: String(userId), did, ...updates })
    .onConflictDoUpdate({
      target: proofs.userId,
      set: { ...updates, did, updatedAt: new Date() },
    });
}

export async function insertResponse(
  userId: string,
  chatId: string,
  responseId: string
) {
  await db.insert(responses).values({ userId, chatId, responseId });
}

export async function findProfile(userId: string) {
  return db
    .select()
    .from(proofs)
    .where(eq(proofs.userId, userId))
    .then((r) => r?.[0] ?? null);
}

export async function findResponses(userId: string) {
  return db.select().from(responses).where(eq(responses.userId, userId));
}
