import { Telegraf, Context, session } from "telegraf";
import { message } from "telegraf/filters";
import express from "express";
import dotenv from "dotenv";
import QRCode from "qrcode";
import { handleMessage } from "./openai";
import { transcribeAudio } from "./transcription";
import {
  initWebSocket,
  REDIRECT_URL,
  QRcodeSteps,
  WS_DB_RELAYER,
} from "./self";
import { createSelfApp } from "./self/config";
import { getCloudRunUrl } from "./gcp";

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN!;
const PORT = parseInt(process.env.PORT || "8080", 10);
let DEPLOYMENT_URL = process.env.DEPLOYMENT_URL;

if (!DEPLOYMENT_URL) {
  // Function to get Cloud Run URL dynamically
  DEPLOYMENT_URL = await getCloudRunUrl();
}

if (!DEPLOYMENT_URL) {
  throw new Error("Couldn't determine the deployment URL");
}

const WEBHOOK_PATH = `/webhook/telegram/${BOT_TOKEN}`;

// Define session interface
interface SessionData {
  requestTimestamps: number[];
  websocketCleanup?: () => void;
  sessionId?: string;
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

async function handleAuth(ctx: MyContext) {
  if (!checkRateLimit(ctx)) return;

  try {
    const chatId = ctx.chat!.id;
    const userId = ctx.from!.id;

    // Clean up any existing WebSocket connection
    if (ctx.session.websocketCleanup) {
      ctx.session.websocketCleanup();
    }

    // Generate a new session ID
    const selfApp = createSelfApp(userId.toString());

    // Set up WebSocket connection
    const cleanup = initWebSocket(
      WS_DB_RELAYER,
      selfApp,
      "websocket",
      (step: number) => {
        // Handle proof step updates
        switch (step) {
          case QRcodeSteps.MOBILE_CONNECTED:
            ctx.reply(
              "📱 Mobile device connected. Please complete authentication in the app."
            );
            break;
          case QRcodeSteps.PROOF_GENERATION_STARTED:
            ctx.reply("🔐 Proof generation started...");
            break;
          case QRcodeSteps.PROOF_GENERATED:
            ctx.reply("✅ Proof generated successfully!");
            break;
          case QRcodeSteps.PROOF_VERIFIED:
            ctx.reply(
              "🎉 Authentication successful! You can now use GainForest bot."
            );
            break;
          case QRcodeSteps.PROOF_GENERATION_FAILED:
            ctx.reply("❌ Authentication failed. Please try again.");
            break;
        }
      },
      () => {
        // On success
        cleanup();
      },
      () => {}
    );

    // Store cleanup function in session
    ctx.session.websocketCleanup = cleanup;

    // Display the redirect URL to the user
    const redirectUrl = `${REDIRECT_URL}?sessionId=${selfApp.sessionId}`;
    console.log("Redirect URL:", redirectUrl);

    // Generate QR code
    const qrCodeDataUrl = await QRCode.toDataURL(redirectUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });

    // Convert data URL to buffer for Telegram
    const qrCodeBuffer = Buffer.from(qrCodeDataUrl.split(",")[1]!, "base64");

    // Send QR code as photo
    await ctx.replyWithChatAction("typing");
    await ctx.replyWithPhoto(
      { source: qrCodeBuffer },
      {
        caption:
          "Scan this QR code using the Self.xyz app, or hit the button below to authenticate.",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🫆 Authenticate using Self.xyz →", url: redirectUrl }],
          ],
        },
      }
    );
  } catch (error) {
    console.error("Auth command error:", error);
    await ctx.reply("Authentication setup failed. Please try again.");
  }
}

bot.start(async (ctx: MyContext) => {
  await ctx.reply(
    `Welcome to GainForest — your thoughtful companion in envisioning GainForest's future.
Together, let us explore how emerging technologies like AI, Blockchain or any other tech that you think of can uplift wellbeing while honoring the wisdom of traditions. Your hopes, feedbacks, bug reports, questions, and ideas will help shape a better future for GainForest.

✨ Speak your truth — through text or voice (under 1 minute) 
🔐 Please begin by authenticating with Self.xyz
🌱 Your data is private and all the code is open-sourced

You're warmly encouraged to guide the conversation — shift topics, share new thoughts, or return to earlier dreams at any time. This space is yours to imagine freely.

Your vision matters deeply.
`
  );
  await handleAuth(ctx);
});

bot.command("auth", handleAuth);

bot.command("profile", async (ctx: MyContext) => {
  if (!checkRateLimit(ctx)) return;
  ctx.replyWithChatAction("typing");
  ctx.reply("Profile command coming soon!");
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

// Express app setup
const app = express();
app.use(express.json());

// Health check endpoint for App Engine
app.get("/", (req, res) => {
  res.send("Telegram Bot is running!");
});

// Telegram webhook endpoint
app.post(WEBHOOK_PATH, (req, res) => {
  try {
    bot.handleUpdate(req.body);
    res.sendStatus(200);
  } catch (error) {
    console.error("Webhook error:", error);
    res.sendStatus(500);
  }
});

// Setup webhook and start server
async function setupBot() {
  try {
    await bot.telegram.setMyCommands([
      { command: "/auth", description: "Authenticate with Self.xyz" },
      { command: "/profile", description: "View your profile - coming soon" },
    ]);

    await bot.telegram.deleteWebhook({ drop_pending_updates: true });

    const webhookUrl = `${DEPLOYMENT_URL}${WEBHOOK_PATH}`;
    console.log(`Setting webhook to: ${webhookUrl}`);

    await bot.telegram.setWebhook(webhookUrl, {
      drop_pending_updates: true,
    });

    console.log("✅ Webhook set successfully");
  } catch (error) {
    console.error("❌ Error setting up webhook:", error);
    // Avoid exiting here – let the server stay up
  }
}

// Start server and keep it running
app.listen(PORT, async () => {
  console.log(`✅ Server listening on port ${PORT}`);
  await setupBot();
});
