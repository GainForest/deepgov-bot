# GainForest Telegram Bot

A thoughtful AI companion for envisioning GainForest's future, powered by Telegram and Self.xyz authentication.

## 🌱 Overview

GainForest Bot is an intelligent conversational AI that helps users explore how emerging technologies like AI, Blockchain, and other innovations can uplift wellbeing while honoring traditional wisdom. The bot provides a secure, private space for users to share their hopes, feedback, questions, and ideas about GainForest's future.

## ✨ Features

- **Secure Authentication**: Self.xyz integration for privacy-preserving identity verification
- **Multi-modal Input**: Support for both text and voice messages (under 1 minute)
- **AI-Powered Conversations**: Intelligent responses using OpenAI's language models
- **Voice Transcription**: Automatic speech-to-text conversion for voice messages
- **Rate Limiting**: Built-in protection against abuse (100 requests per hour)
- **Real-time Status Updates**: WebSocket-based authentication progress tracking
- **QR Code Authentication**: Easy mobile authentication via QR codes

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ or Bun runtime
- Telegram Bot Token
- OpenAI API Key
- Self.xyz backend endpoint
- Deployment URL (for webhooks)

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd deepgov-bot
   ```

2. **Install dependencies**

   ```bash
   bun install
   # or
   npm install
   ```

3. **Configure environment variables**

   ```bash
   cp .env.example .env
   ```

   Add the following to your `.env` file:

   ```env
   BOT_TOKEN=your_telegram_bot_token
   OPENAI_API_KEY=your_openai_api_key
   SELF_BACKEND_ENDPOINT=your_self_backend_url
   DEPLOYMENT_URL=your_deployment_url
   PORT=8080
   ```

4. **Start the bot**
   ```bash
   bun start
   # or
   npm start
   ```

## 🔐 Authentication Flow

The bot uses Self.xyz for secure, privacy-preserving authentication:

1. **Initiation**: User starts the bot or sends `/auth` command
2. **QR Code Generation**: Bot creates a QR code linking to Self.xyz authentication
3. **Mobile Connection**: User scans QR code with Self.xyz mobile app
4. **Proof Generation**: Self.xyz generates a zero-knowledge proof
5. **Verification**: Proof is verified on the backend
6. **Access Granted**: User can now interact with the AI companion

### Authentication Steps

- `DISCONNECTED`: Initial state
- `WAITING_FOR_MOBILE`: Waiting for mobile device connection
- `MOBILE_CONNECTED`: Mobile device successfully connected
- `PROOF_GENERATION_STARTED`: Zero-knowledge proof generation begins
- `PROOF_GENERATED`: Proof created successfully
- `PROOF_VERIFIED`: Authentication complete
- `PROOF_GENERATION_FAILED`: Authentication failed

## 🏗️ Architecture

### Core Components

- **Telegram Bot** (`src/index.ts`): Main bot logic with Telegraf
- **Self.xyz Integration** (`src/self/`): Authentication and WebSocket handling
- **OpenAI Integration** (`src/openai.ts`): AI conversation handling
- **Voice Transcription** (`src/transcription.ts`): Speech-to-text conversion
- **Database Layer** (`src/db/`): Data persistence with Drizzle ORM

### Key Technologies

- **Runtime**: Bun/Node.js with TypeScript
- **Bot Framework**: Telegraf
- **Authentication**: Self.xyz with WebSocket communication
- **AI**: OpenAI GPT models
- **Database**: Neon PostgreSQL with Drizzle ORM
- **Voice Processing**: OpenAI Whisper API
- **QR Codes**: qrcode library

## 📱 Usage

### Commands

- `/start` - Initialize the bot and begin authentication
- `/auth` - Re-authenticate with Self.xyz
- `/profile` - View user profile (coming soon)

### Message Types

- **Text Messages**: Direct conversation with the AI
- **Voice Messages**: Automatic transcription and AI response
- **File Uploads**: Not currently supported

## 🔧 Development

### Development Mode

```bash
bun run dev
```

This runs the bot in watch mode with automatic restarts on file changes.

### Building

```bash
bun run build
```

Compiles TypeScript to JavaScript.

### Environment Variables

| Variable                | Description                        | Required |
| ----------------------- | ---------------------------------- | -------- |
| `BOT_TOKEN`             | Telegram Bot API token             | ✅       |
| `OPENAI_API_KEY`        | OpenAI API key for AI responses    | ✅       |
| `SELF_BACKEND_ENDPOINT` | Self.xyz backend URL               | ✅       |
| `DEPLOYMENT_URL`        | Public deployment URL for webhooks | ✅       |
| `PORT`                  | Server port (default: 8080)        | ❌       |

## 🛡️ Security & Privacy

- **Zero-Knowledge Proofs**: Self.xyz ensures user privacy
- **Rate Limiting**: 100 requests per hour per user
- **Session Management**: Secure session handling with cleanup
- **WebSocket Security**: Encrypted WebSocket connections
- **Data Privacy**: User data is private and code is open-sourced

## 🌐 Deployment

### App Engine (Recommended)

The bot is configured for Google App Engine deployment with webhook support.

### Environment Setup

1. Set all required environment variables
2. Ensure `DEPLOYMENT_URL` points to your public domain
3. Configure webhook endpoint: `https://your-domain.com/webhook/telegram/{BOT_TOKEN}`

### Health Check

The bot provides a health check endpoint at `/` for monitoring.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is open source. See [LICENSE](LICENSE) for details.

## 🆘 Support

For issues and questions:

- Check the [Issues](https://github.com/your-repo/issues) page
- Review the authentication flow documentation
- Ensure all environment variables are properly configured

---

**GainForest Bot** - Envisioning a better future through thoughtful AI conversations. 🌱✨
