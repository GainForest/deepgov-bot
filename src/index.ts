import { Telegraf, Context } from "telegraf";
import express from "express";
import type { Request, Response } from "express";
import axios, { AxiosError } from "axios";
import dotenv from "dotenv";
import { db } from "./db/client";
import { proofs } from "./db/schema";

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN!;
const NDI_CLIENT_ID = process.env.NDI_CLIENT_ID!;
const NDI_CLIENT_SECRET = process.env.NDI_CLIENT_SECRET!;
const WEBHOOK_URL = process.env.WEBHOOK_URL!;
const LINK_URL = process.env.LINK_URL!;
const WEBHOOK_ID = "tg-webhook-3";
const PORT = parseInt(process.env.PORT || "3000", 10);

const NDI_AUTH_URL =
  "https://staging.bhutanndi.com/authentication/v1/authenticate";
const NDI_WEBHOOK_URL = "https://demo-client.bhutanndi.com/webhook/v1";
const NDI_VERIFIER_URL =
  "https://demo-client.bhutanndi.com/verifier/v1/proof-request";
const FOUNDATION_ID_SCHEMA =
  "https://dev-schema.ngotag.com/schemas/c7952a0a-e9b5-4a4b-a714-1e5d0a1ae076";
const ADDRESS_ID_SCHEMA =
  "https://dev-schema.ngotag.com/schemas/e3b606d0-e477-4fc2-b5ab-0adc4bd75c54";

let ndiAccessToken: string | null = null;
const threadMap = new Map<string, { chatId: number; userId: number }>();

async function getNdiAccessToken(): Promise<string> {
  if (ndiAccessToken) return ndiAccessToken;

  const res = await axios.post(NDI_AUTH_URL, {
    client_id: NDI_CLIENT_ID,
    client_secret: NDI_CLIENT_SECRET,
    grant_type: "client_credentials",
  });

  ndiAccessToken = res.data.access_token;
  return ndiAccessToken!;
}

async function makeNdiRequest(method: "get" | "post", url: string, data?: any) {
  const token = await getNdiAccessToken();
  return axios({
    method,
    url,
    data,
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function webhookExists(): Promise<boolean> {
  try {
    const response = await makeNdiRequest(
      "get",
      `${NDI_WEBHOOK_URL}?pageSize=10&page=1&webhookId=${WEBHOOK_ID}`
    );
    const webhooks = response.data.data?.webhooks || [];
    return webhooks.some((webhook: any) => webhook.webhookId === WEBHOOK_ID);
  } catch (err) {
    return (err as AxiosError).response?.status !== 404;
  }
}

async function ensureWebhook() {
  if (await webhookExists()) return;

  try {
    const token = await getNdiAccessToken();
    await makeNdiRequest("post", `${NDI_WEBHOOK_URL}/register`, {
      webhookId: WEBHOOK_ID,
      webhookURL: WEBHOOK_URL,
      authentication: { type: "OAuth2", version: "v2", data: { token } },
    });
    console.log("Webhook registered");
  } catch (err) {
    if ((err as AxiosError).response?.status !== 409) throw err;
  }
}

async function createProofRequest(
  chatId: number,
  userId: number
): Promise<string> {
  const proofAttributes = [
    ...["Gender", "Date of Birth", "Citizenship"].map((name) => ({
      name,
      restrictions: [{ schema_name: FOUNDATION_ID_SCHEMA }],
    })),
    ...["Village", "Gewog", "Dzongkhag"].map((name) => ({
      name,
      restrictions: [{ schema_name: ADDRESS_ID_SCHEMA }],
    })),
  ];

  const proofRes = await makeNdiRequest("post", NDI_VERIFIER_URL, {
    proofName: "Telegram NDI Auth",
    proofAttributes,
  });

  const { proofRequestThreadId, deepLinkURL } = proofRes.data.data;
  threadMap.set(proofRequestThreadId, { chatId, userId });

  try {
    await makeNdiRequest("post", `${NDI_WEBHOOK_URL}/subscribe`, {
      webhookId: WEBHOOK_ID,
      threadId: proofRequestThreadId,
    });
  } catch (err) {
    if ((err as AxiosError).response?.status !== 409) throw err;
  }

  return deepLinkURL;
}

const bot = new Telegraf(BOT_TOKEN);
bot.start(async (ctx: Context) => ctx.reply("Welcome!"));

bot.command("auth", async (ctx) => {
  try {
    const chatId = ctx.chat!.id;
    const userId = ctx.from!.id;

    console.log(chatId, userId);
    await ensureWebhook();
    const link = await createProofRequest(chatId, userId);

    await ctx.reply("🔒 Authenticate via Bhutan NDI Wallet:", {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Authenticate",
              url: `${LINK_URL}?link=${encodeURIComponent(link)}`,
            },
          ],
        ],
      },
    });
  } catch (error) {
    console.error("Auth command error:", error);
    await ctx.reply("Authentication setup failed. Please try again.");
  }
});

async function handleWebhook(req: Request, res: Response) {
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
      await db
        .insert(proofs)
        .values({ userId: String(userId), did, ...updates })
        .onConflictDoUpdate({
          target: proofs.userId,
          set: { ...updates, did, updatedAt: new Date() },
        });
      console.log(`Stored proof for ${did} to DB`);
    } catch (e) {
      console.error("Failed to store proof:", e);
    }

    if (chatId) {
      const verified = body.verification_result === "ProofValidated";
      const text = verified
        ? "✅ Successfully authenticated!"
        : "❌ Authentication failed or was rejected.";

      await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        chat_id: chatId,
        text,
      });

      threadMap.delete(threadId);
    }
  }

  res.sendStatus(202);
}

bot.launch();

const app = express();
app.use(express.json());

app.post("/webhook", handleWebhook);
app.listen(PORT, () =>
  console.log(`✅ Webhook server listening on port ${PORT}`)
);
