import { Telegraf, Context } from "telegraf";
import { session } from "telegraf";
import express from "express";
import dotenv from "dotenv";
import { ensureWebhook, createProofRequest } from "./ndi";
import { handleWebhook } from "./webhook";
import { message } from "telegraf/filters";
import { handleMessage } from "./openai";

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN!;
const LINK_URL = process.env.LINK_URL!;
const PORT = parseInt(process.env.PORT || "3000", 10);

// Define session interface
interface SessionData {
  language: "EN" | "BT";
  requestTimestamps: number[];
}

// Extend context to include session
interface MyContext extends Context {
  session: SessionData;
}

const bot = new Telegraf<MyContext>(BOT_TOKEN);

// Use session middleware
bot.use(session());

// Initialize session data
bot.use(async (ctx, next) => {
  if (!ctx.session) {
    ctx.session = {
      language: "EN",
      requestTimestamps: [],
    };
  }
  await next();
});

bot.start(async (ctx: MyContext) => {
  await ctx.reply("Welcome");
});

bot.command("auth", async (ctx: MyContext) => {
  if (!checkRateLimit(ctx)) return;

  try {
    const chatId = ctx.chat!.id;
    const userId = ctx.from!.id;

    await ctx.reply("Creating authentication request...");
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

bot.on(message("text"), async (ctx: MyContext) => {
  if (!checkRateLimit(ctx)) return;
  const chatId = ctx.chat.id;
  const userInput = ctx.message.text;

  const reply = await handleMessage(chatId, userInput);
  await ctx.reply(reply);
});

bot.launch();

const app = express();
app.use(express.json());

app.post("/webhook", handleWebhook);
app.listen(PORT, () =>
  console.log(`✅ Webhook server listening on port ${PORT}`)
);

function checkRateLimit(ctx: MyContext): boolean {
  const now = Date.now();
  const windowMs = 3600000; // 1 hour
  const maxRequests = 100;
  const cutoff = now - windowMs;

  // Clean old timestamps
  ctx.session.requestTimestamps = ctx.session.requestTimestamps.filter(
    (timestamp) => timestamp > cutoff
  );

  if (ctx.session.requestTimestamps.length >= maxRequests) {
    const lang = ctx.session.language;
    ctx.reply(messages.rateLimited[lang]);
    return false;
  }

  ctx.session.requestTimestamps.push(now);
  return true;
}
