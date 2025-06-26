# Takin AI - Telegram Bot

Conversational AI system for Bhutan's digital governance initiative.

## Quick Start

```bash
bun install
cp .env.example .env
# Edit .env with your API keys
bun run dev
```

## Features

- AI-powered conversations via OpenAI
- Voice message transcription 
- NDI wallet integration for digital identity
- Rate limiting and session management
- Privacy-focused: Telegram user IDs are hashed for privacy

## Environment Setup

Copy `.env.example` to `.env` and configure:

- `BOT_TOKEN` - Telegram bot token
- `DATABASE_URL` - PostgreSQL connection
- `OPENAI_API_KEY` - OpenAI API key
- `NDI_CLIENT_ID`, `NDI_CLIENT_SECRET` - NDI credentials
- `WHISPER_API_KEY` - Voice transcription API

## Commands

- `bun run dev` - Development with file watching
- `bun run start` - Production mode

## How It Works

1. Users chat with the bot via Telegram
2. Text messages processed through OpenAI
3. Voice messages transcribed then processed
4. NDI authentication enables digital credentials
5. Active users (15+ interactions) can claim verifiable credentials