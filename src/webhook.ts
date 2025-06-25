import type { Request, Response } from "express";
import axios from "axios";
import dotenv from "dotenv";
import { db } from "./db/client";
import { proofs } from "./db/schema";
import { threadMap } from "./ndi";
import { upsertProof } from "./db/api";

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN!;

export async function handleWebhook(req: Request, res: Response) {
  const { body } = req;
  const threadId = body.thid || body.threadId;

  console.log(JSON.stringify(body, null, 2));

  if (
    body.type === "present-proof/presentation-result" &&
    body.verification_result === "ProofValidated" &&
    threadId
  ) {
    const { chatId, userId } = threadMap.get(threadId) ?? {};

    const did: string = body.holder_did;
    const attrs = body.requested_presentation?.revealed_attrs || {};

    const gender = attrs["Gender"]?.[0]?.value!;
    const citizenship = attrs["Citizenship"]?.[0]?.value!;
    const address1 = attrs["Village"]?.[0]?.value!;
    const address2 = attrs["Gewog"]?.[0]?.value!;
    const address3 = attrs["Dzongkhag"]?.[0]?.value!;

    const dobString = attrs["Date of Birth"]?.[0]?.value!;
    const [day, month, year] = dobString.split("/").map(Number);
    const dob = new Date(Date.UTC(year, month - 1, day));

    const updates = { gender, dob, citizenship, address1, address2, address3 };

    console.log(updates, { userId, chatId });

    try {
      await upsertProof(String(userId), did, updates);
      console.log(`Stored proof for ${did} to DB`);
    } catch (e) {
      console.error("Failed to store proof:", e);
    }

    if (chatId) {
      const verified = body.verification_result === "ProofValidated";
      const text = verified
        ? " Successfully authenticated!"
        : "L Authentication failed or was rejected.";

      await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        chat_id: chatId,
        text,
      });

      threadMap.delete(threadId);
    }
  }

  res.sendStatus(202);
}
