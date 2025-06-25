// index.ts
import { Telegraf, Context } from "telegraf";
import express from "express";
import type { Request, Response } from "express";
import axios, { AxiosError } from "axios";
import dotenv from "dotenv";

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN!;
const NDI_CLIENT_ID = process.env.NDI_CLIENT_ID!;
const NDI_CLIENT_SECRET = process.env.NDI_CLIENT_SECRET!;
const WEBHOOK_URL = process.env.WEBHOOK_URL!; // e.g. https://yourdomain.com/webhook
const WEBHOOK_ID = "tg-webhook-3"; // unique ID for your registration

let ndiAccessToken: string | null = null;
const threadMap = new Map<string, number>(); // proofRequestThreadId → chatId

async function getNdiAccessToken(): Promise<string> {
  if (ndiAccessToken) return ndiAccessToken;
  const res = await axios.post(
    "https://staging.bhutanndi.com/authentication/v1/authenticate",
    {
      client_id: NDI_CLIENT_ID,
      client_secret: NDI_CLIENT_SECRET,
      grant_type: "client_credentials",
    }
  );

  ndiAccessToken = res.data.access_token;
  return ndiAccessToken!;
}

async function checkWebhookExists(): Promise<boolean> {
  const token = await getNdiAccessToken();
  try {
    const response = await axios.get(
      `https://demo-client.bhutanndi.com/webhook/v1?pageSize=10&page=1&webhookId=${WEBHOOK_ID}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    console.log(response.data);
    // Check if the webhook exists in the response
    const webhooks = response.data.data?.webhooks || [];
    return webhooks.some((webhook: any) => webhook.webhookId === WEBHOOK_ID);
  } catch (err) {
    const ae = err as AxiosError;
    if (ae.response?.status === 404) {
      return false;
    }
    console.error("Error checking webhook existence:", ae.message);
    return false;
  }
}

async function registerWebhook() {
  const token = await getNdiAccessToken();

  // Check if webhook already exists
  const webhookExists = await checkWebhookExists();
  if (webhookExists) {
    console.log("Webhook already exists, skipping registration.");
    return;
  }

  try {
    await axios.post(
      "https://demo-client.bhutanndi.com/webhook/v1/register",
      {
        webhookId: WEBHOOK_ID,
        webhookURL: WEBHOOK_URL,
        authentication: {
          type: "OAuth2",
          version: "v2",
          data: { token },
        },
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log("Webhook registered.");
  } catch (err) {
    const ae = err as AxiosError;
    if (ae.response?.status === 409) {
      console.log("Webhook already registered, continuing...");
    } else {
      throw err;
    }
  }
}

async function createAndSubscribeProof(chatId: number) {
  const token = await getNdiAccessToken();
  const proofAttributes = [
    // Foundation ID
    ...["Gender", "Date of Birth", "Citizenship"].map((name) => ({
      name,
      restrictions: [
        {
          schema_name:
            "https://dev-schema.ngotag.com/schemas/c7952a0a-e9b5-4a4b-a714-1e5d0a1ae076",
        },
      ],
    })),
    // // Permanent Address
    // ...["Village", "Gewog", "Dzongkhag"].map((name) => ({
    //   name,
    //   restrictions: [
    //     {
    //       schema_name:
    //         "https://dev-schema.ngotag.com/schemas/a3b6060d-e7f7-4fc2-b5ab-0adc4bd75c54",
    //     },
    //   ],
    // })),

    // // Work Permit
    // ...["Job Category", "Location Dzongkhag"].map((name) => ({
    //   name,
    //   restrictions: [
    //     {
    //       schema_name:
    //         "https://dev-schema.ngotag.com/schemas/dbdd750c-72bf-4636-b541-44d925533116",
    //     },
    //   ],
    // })),

    // // Student Permit
    // ...["Expiry Date", "Issue Date", "Institution"].map((name) => ({
    //   name,
    //   restrictions: [
    //     {
    //       schema_name:
    //         "https://dev-schema.ngotag.com/schemas/aa292934-1314-44c7-94e9-b4c8f06d33c3",
    //     },
    //   ],
    // })),
  ];
  // a) Create proof request
  const proofRes = await axios.post(
    "https://demo-client.bhutanndi.com/verifier/v1/proof-request",
    {
      proofName: "Telegram NDI Auth",
      proofAttributes,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  const { proofRequestThreadId, deepLinkURL } = proofRes.data.data;
  threadMap.set(proofRequestThreadId, chatId);

  console.log(proofRequestThreadId);
  // b) Subscribe to webhook (ignore duplicate)
  try {
    await axios.post(
      "https://demo-client.bhutanndi.com/webhook/v1/subscribe",
      {
        webhookId: WEBHOOK_ID,
        threadId: proofRequestThreadId,
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log(`Subscribed to thread ${proofRequestThreadId}`);
  } catch (err) {
    const ae = err as AxiosError;
    if (ae.response?.status === 409) {
      console.log(`Already subscribed to ${proofRequestThreadId}`);
    } else {
      throw err;
    }
  }

  return deepLinkURL;
}
const linkURL = process.env.LINK_URL!;

const bot = new Telegraf(BOT_TOKEN);
bot.start(async (ctx: Context) => ctx.reply("Welcome!"));

bot.command("auth", async (ctx) => {
  try {
    const chatId = ctx.chat!.id;

    await registerWebhook();

    const link = await createAndSubscribeProof(chatId);
    await ctx.reply("🔒 Authenticate via Bhutan NDI Wallet:", {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Authenticate",
              url: `${linkURL}?link=${encodeURIComponent(link)}`,
            },
          ],
        ],
      },
    });
  } catch (error) {
    console.log(error);
  }
});
bot.launch();

const app = express();
app.use(express.json());

export async function handleWebhook(req: Request, res: Response) {
  const body = req.body;
  const incomingThid = body.thid || body.threadId;
  if (body.type === "present-proof/presentation-result" && incomingThid) {
    const chatId = threadMap.get(incomingThid);
    if (chatId) {
      const verified = body.verification_result === "ProofValidated";
      const text = verified
        ? `✅ Successfully authenticated!`
        : `❌ Authentication failed or was rejected.`;

      await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        chat_id: chatId,
        text,
      });

      // Optionally: threadMap.delete(incomingThid);
    }
  }
  res.sendStatus(202);
}

app.post("/webhook", handleWebhook);

const PORT = parseInt(process.env.PORT || "3000", 10);
app.listen(PORT, () =>
  console.log(`✅ Webhook server listening on port ${PORT}`)
);
