import { db } from "./client";
import { proofs } from "./schema";

export async function upsertProof(userId: string, did: string, updates: any) {
  await db
    .insert(proofs)
    .values({ userId: String(userId), did, ...updates })
    .onConflictDoUpdate({
      target: proofs.userId,
      set: { ...updates, did, updatedAt: new Date() },
    });
}
