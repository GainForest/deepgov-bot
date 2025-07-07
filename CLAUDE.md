# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Install dependencies**: `bun install`
- **Start production**: `bun run start` (runs `src/index.ts`)
- **Start development**: `bun run dev` (runs with file watching)
- **Database migrations**: `drizzle-kit` commands (check `drizzle.config.ts`)

## Architecture Overview

This is a Telegram bot for "Takin AI" - a conversational AI system for Bhutan's digital governance initiative that integrates with:

### Core Components

- **Telegram Bot** (`src/index.ts`): Main bot logic using Telegraf framework

  - Handles text and voice messages
  - Built-in rate limiting (100 requests/hour per user)
  - Session management for user state
  - Commands: `/auth`, `/profile`, `/claim`

- **AI Processing** (`src/openai.ts`): Message processing through OpenAI

  - Text message handling
  - Voice transcription integration

- **Database Layer** (`src/db/`):

  - **Schema** (`schema.ts`): Drizzle ORM schemas for `proofs` and `responses` tables
  - **Client** (`client.ts`): Neon PostgreSQL connection
  - **API** (`api.ts`): Database operations for profiles and responses

- **Audio Processing** (`src/transcription.ts`): Voice message transcription via Whisper API (RunPod)

- **Webhook Server** (`src/webhook.ts`): Express server for NDI webhook callbacks

### Key Integrations

- **PostgreSQL**: Using Neon serverless with Drizzle ORM
- **OpenAI**: For message processing and AI responses
- **Whisper API**: For voice message transcription (RunPod hosted)
- **NDI Wallet**: Bhutan's digital identity system for authentication and credentials
- **Telegram**: Bot API for messaging interface

### Environment Configuration

Required environment variables (see `.env.example`):

- `BOT_TOKEN`: Telegram bot token
- `DATABASE_URL`: PostgreSQL connection string
- `NDI_CLIENT_ID`, `NDI_CLIENT_SECRET`: NDI integration credentials
- `OPENAI_API_KEY`: OpenAI API access
- `WHISPER_API_KEY`: RunPod Whisper API key
- `DEPLOYMENT_URL`, `LINK_URL`: Webhook and frontend URLs
- `HMAC_SECRET_KEY`, `HASH_SALT`: Security keys for data integrity

### Data Flow

1. User interacts via Telegram (text/voice)
2. Rate limiting and session management applied
3. Voice messages transcribed via Whisper API
4. Messages processed through OpenAI for AI responses
5. User interactions logged to database
6. NDI authentication enables profile access
7. After 15+ interactions, users can claim credentials via NDI wallet

### Security Features

- Rate limiting (100 requests/hour per user)
- HMAC verification for webhooks
- Environment-based configuration
- Session-based user state management
