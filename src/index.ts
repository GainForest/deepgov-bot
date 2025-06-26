import { Telegraf, Context, TelegramError } from "telegraf";
import { session } from "telegraf";
import express from "express";
import dotenv from "dotenv";
import { ensureWebhook, createProofRequest } from "./ndi";
import { handleWebhook } from "./webhook";
import { message } from "telegraf/filters";
import { handleMessage } from "./openai";
import { transcribeAudio } from "./transcription";
import { findProfile } from "./db/api";

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

bot.command("profile", async (ctx: MyContext) => {
  if (!checkRateLimit(ctx)) return;

  try {
    const chatId = ctx.chat!.id;
    const userId = ctx.from!.id;
    console.log({ userId });
    const profile = await findProfile(String(userId));
    console.log(profile);
    if (!profile) return ctx.reply("No profile found");
    await ctx.replyWithMarkdownV2(
      `*👤 User Profile*

*Gender:* ${profile.gender}
*Date of Birth:* ${new Date(profile.dob).toLocaleDateString()}
*Citizenship:* ${profile.citizenship}
*Address:*
• Village: ${profile.address1}
• Gewog: ${profile.address2}
• Dzongkhag: ${profile.address3}
    `
    );
  } catch (error) {
    console.error("Profile command error:", error);
    await ctx.reply("Fetching profile failed. Please try again.");
  }
});

bot.on(message("text"), async (ctx: MyContext) => {
  if (!checkRateLimit(ctx)) return;

  if (!ctx.chat || !ctx.from || !ctx.message || !("text" in ctx.message)) {
    await ctx.reply("Invalid message format.");
    return;
  }

  const chatId = ctx.chat.id;
  const userId = ctx.from.id;
  const userInput = ctx.message.text;

  const reply = await handleMessage(chatId, userId, userInput);
  await ctx.reply(reply);
});

bot.on(message("voice"), async (ctx: MyContext) => {
  if (!checkRateLimit(ctx)) return;

  if (!ctx.chat || !ctx.from || !ctx.message || !("voice" in ctx.message)) {
    await ctx.reply("Invalid voice message format.");
    return;
  }

  const chatId = ctx.chat.id;
  const userId = ctx.from.id;
  console.log("voice", chatId);

  try {
    await ctx.reply("🎵 Processing your voice message...");

    const fileId = ctx.message.voice.file_id;
    const file = await ctx.telegram.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

    // Transcribe the audio
    const transcription = await transcribeAudio(fileUrl);

    if (transcription && transcription.trim()) {
      await ctx.reply(`🎤 Transcription: "${transcription}"`);

      // Process the transcribed text through the normal message handler
      const reply = await handleMessage(chatId, userId, transcription);
      await ctx.reply(reply);
    } else {
      await ctx.reply(
        "Could not transcribe the audio. Please try again or send a text message."
      );
    }
  } catch (error) {
    console.error("Audio message error:", error);
    await ctx.reply("Failed to process audio message. Please try again.");
  }
});

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
    ctx.reply("Rate limit exceeded. Please try again later.");
    return false;
  }

  ctx.session.requestTimestamps.push(now);
  return true;
}

// (async () => {
// const WEBHOOK_PATH = `/telegraf/${bot.secretPathComponent()}`;
// const BASE_URL = process.env.BASE_URL; // e.g. "https://mydomain.com"

// await bot.telegram.deleteWebhook();
// })();

await bot.launch();

process.once("SIGINT", () => {
  console.info("SIGINT received");
  bot.stop("SIGINT");
});

process.once("SIGTERM", () => {
  console.info("SIGTERM received");
  bot.stop("SIGTERM");
});
