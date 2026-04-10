# ChatPay - WhatsApp Fintech Platform

ChatPay is a modern fintech engine that allows users to perform financial transactions entirely via WhatsApp.

## Features
- **AI-Powered Onboarding**: Natural language sign-up and KYC.
- **P2P Payments**: Send funds to other users via chat.
- **Utility Payments**: Pay bills and buy airtime.
- **Business Tools**: Dedicated virtual accounts and sales tracking.

## Tech Stack
- **Messaging**: Whapi.cloud
- **Payments**: Fincra
- **Utilities**: Flutterwave
- **AI Layer**: OpenAI (GPT-4o)
- **Database**: PostgreSQL with Prisma
- **Backend**: Node.js (TypeScript)

## Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Setup .env**:
   Fill in your API keys in the `.env` file.
   - `OPENAI_API_KEY`
   - `WHAPI_TOKEN`
   - `FINCRA_API_KEY`
   - `FLUTTERWAVE_SECRET_KEY`
   - `DATABASE_URL`

3. **Database Setup**:
   ```bash
   npx prisma db push
   ```

4. **Run Development Server**:
   ```bash
   npm run dev
   ```

## Webhook Configuration
Set your Whapi.cloud webhook URL to: `https://your-domain.com/webhook/whatsapp`
