# DeepGov Bhutan Telegram

To install dependencies:

```bash
bun install
```

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Telegram Bot Configuration
BOT_TOKEN=your_telegram_bot_token_here

# Server Configuration
PORT=3000
LINK_URL=https://your-frontend-url.com

# NDI Configuration
NDI_CLIENT_ID=your_ndi_client_id
NDI_CLIENT_SECRET=your_ndi_client_secret
WEBHOOK_URL=https://your-webhook-url.com/webhook

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# Whisper API Configuration (RunPod)
WHISPER_API_KEY=your_runpod_whisper_api_key
```

## Features

- **Text Messages**: Process text messages through OpenAI
- **Voice Messages**: Transcribe voice messages using Whisper API and process the transcription
- **Authentication**: NDI wallet integration for user authentication
- **Rate Limiting**: Built-in rate limiting to prevent abuse

To run:

```bash
bun run start
```

```bash
bun run dev
```
