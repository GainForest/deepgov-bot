import { Telegraf, Context, session } from "telegraf";
import { message } from "telegraf/filters";
import express from "express";
import dotenv from "dotenv";
import { ensureWebhook, createProofRequest } from "./ndi";
import { handleWebhook } from "./webhook";
import { handleMessage } from "./openai";
import { transcribeAudio } from "./transcription";
import { findProfile } from "./db/api";

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN!;
const LINK_URL = process.env.LINK_URL!;
const PORT = parseInt(process.env.PORT || "3000", 10);

// Define session interface
interface SessionData {
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
      requestTimestamps: [],
    };
  }
  await next();
});

bot.start(async (ctx: MyContext) => {
  await ctx.reply(`Meet Takin AI, your thoughtful guide to imagining Bhutan's digital future. Together, explore how AI, Blockchain, and National Decentralized Identity can serve our wellbeing while honoring our rich traditions. Share your dreams, voice your concerns, and help shape a 2035 where technology and culture thrive in harmony.
Your vision matters. Start the conversation.`);
});

bot.command("auth", async (ctx: MyContext) => {
  if (!checkRateLimit(ctx)) return;

  try {
    const chatId = ctx.chat!.id;
    const userId = ctx.from!.id;

    await ctx.replyWithChatAction("typing");
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
    await ctx.replyWithChatAction("typing");
    const userId = ctx.from!.id;
    const profile = await findProfile(String(userId));
    if (!profile)
      return ctx.reply("No profile found. Please authenticate first.");
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

async function checkAuth(ctx: MyContext) {
  const profile = await findProfile(String(ctx.from.id));
  if (!profile) {
    await ctx.reply("Please authenticate first with /auth.");
    return;
  }
}
bot.on(message("text"), async (ctx: MyContext) => {
  if (!checkRateLimit(ctx)) return;

  if (!ctx.chat || !ctx.from || !ctx.message || !("text" in ctx.message)) {
    await ctx.reply("Invalid message format.");
    return;
  }

  await checkAuth(ctx);

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

bot.settings(async (ctx) => {
  await ctx.telegram.setMyCommands([
    {
      command: "/auth",
      description: "Authenticate with NDI wallet",
    },
    {
      command: "/profile",
      description: "View your profile",
    },
  ]);
  return ctx.reply("Commands set");
});

await bot.launch();

process.once("SIGINT", () => {
  console.info("SIGINT received");
  bot.stop("SIGINT");
});

process.once("SIGTERM", () => {
  console.info("SIGTERM received");
  bot.stop("SIGTERM");
});
