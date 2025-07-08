# 🚀 Complete Telegram Bot Deployment Guide

_Deploy your Telegram bot to Google Cloud Run with automatic CI/CD_

## 📋 Overview

This guide will help you deploy a Node.js Telegram bot to Google Cloud Run with:

- ✅ **Automatic deployments** on every git push
- ✅ **Secure secret management**
- ✅ **Auto-scaling** and **99.9% uptime**
- ✅ **Webhook-based** bot (no polling)
- ✅ **Cost-optimized** (typically $5-20/month)

---

## 📌 Prerequisites

- **Telegram Bot Token** from [@BotFather](https://t.me/BotFather)
- **GitHub account** with your bot code repository
- **Google account** for Google Cloud Platform

---

## 🎯 Step 1: Google Cloud Account & Billing Setup

### 1.1 Create Google Cloud Account

1. **Go to [Google Cloud Console](https://console.cloud.google.com)**
2. **Sign in** with your Google account (or create one)
3. **Accept terms and conditions** when prompted

### 1.2 Enable Billing

1. **Click "Billing"** in the left sidebar
2. **Click "MANAGE BILLING ACCOUNTS"**
3. **Click "CREATE ACCOUNT"**
4. **Add your payment method**
   - You get **$300 in free credits** for new accounts
   - Most bots cost under $20/month to run

### 1.3 Create New Project

1. **Click the project dropdown** at the top (says "Select a project")
2. **Click "NEW PROJECT"**
3. **Choose your project name** (this will be your **namespace**)
   - Example: `telegram-weather-bot`, `crypto-trading-bot`, `deepgovbot`
   - **Important:** Remember this name - we'll use it throughout the guide
4. **Click "CREATE"**
5. **Select your new project** from the dropdown

**📝 Note:** Your project name will be your **namespace** for the rest of this guide.

---

## ⚙️ Step 2: Enable Required APIs

1. **Go to APIs & Services > Library** (left sidebar)
2. **Search and enable these 4 APIs:**

   **API 1: Cloud Build API**

   - Search "Cloud Build API" → Click → **ENABLE**

   **API 2: Cloud Run Admin API**

   - Search "Cloud Run Admin API" → Click → **ENABLE**

   **API 3: Secret Manager API**

   - Search "Secret Manager API" → Click → **ENABLE**

   **API 4: Artifact Registry API**

   - Search "Artifact Registry API" → Click → **ENABLE**

**✅ Verification:** Go to "APIs & Services > Enabled APIs" to confirm all 4 are listed.

---

## 🏷️ Step 3: Define Your Namespace

For the rest of this guide, we'll use **"namespace"** to refer to your project name.

**Example:** If your project is called `crypto-trading-bot`, then:

- Namespace = `crypto-trading-bot`
- Project ID = `crypto-trading-bot`
- All resources will use this name

**📝 Write down your namespace:** `________________________`

---

## 👤 Step 4: Create Service Account

### 4.1 Create Service Account

1. **Go to IAM & Admin > Service Accounts** (left sidebar)
2. **Click "CREATE SERVICE ACCOUNT"**
3. **Enter details:**
   - Service account name: `{namespace}` (use your actual namespace)
   - Service account ID: (auto-filled)
   - Description: "Service account for {namespace} Telegram bot"
   - **Click "CREATE AND CONTINUE"**
4. **Skip role assignment** for now (click "CONTINUE")
5. **Click "DONE"**

### 4.2 Save Service Account Email

Your service account email will be: `{namespace}@{namespace}.iam.gserviceaccount.com`

**📝 Save this email:** `________________________@________________________.iam.gserviceaccount.com`

**Example:** If namespace = `crypto-trading-bot`, email = `crypto-trading-bot@crypto-trading-bot.iam.gserviceaccount.com`

---

## 🔗 Step 5: Create Cloud Build Trigger

### 5.1 Connect GitHub Repository

1. **Go to Cloud Build > Triggers** (left sidebar)
2. **Click "CONNECT REPOSITORY"**
3. **Select "GitHub (Cloud Build GitHub App)"**
4. **Click "CONTINUE"**
5. **Authorize Google Cloud Build** (follow GitHub prompts)
6. **Select your bot repository** from the list
7. **Click "CONNECT"**

### 5.2 Create Build Trigger

1. **Click "CREATE TRIGGER"**
2. **Configure trigger:**
   - Name: `{namespace}-deploy`
   - Event: "Push to a branch"
   - Source: (your connected repository)
   - Branch: `^main$`
   - Configuration: "Cloud Build configuration file"
   - Location: `cloudbuild.yaml`
3. **Click "CREATE"**

---

## 🔐 Step 6: Add Secrets to Secret Manager

### 6.1 Find Required Secrets

1. **Open your `cloudbuild.yaml` file**
2. **Search for the line containing `--set-secrets=`**
3. **Extract the secret IDs** from this line

**Example:** If your line looks like:

```
--set-secrets=BOT_TOKEN=bot-token:latest,OPENAI_API_KEY=openai-api-key:latest,DATABASE_URL=database-url:latest
```

You need to create these secret IDs: `bot-token`, `openai-api-key`, `database-url`

### 6.2 Create Each Secret

1. **Go to Security > Secret Manager** (left sidebar)
2. **For each secret ID found above:**
   - **Click "CREATE SECRET"**
   - Secret ID: `{secret-id}` (the lowercase part after `=`)
   - Secret value: Your actual secret value
   - **Click "CREATE SECRET"**

**Example using the line above:**

- Secret ID: `bot-token` → Secret value: `{your-bot-token-secret}`
- Secret ID: `openai-api-key` → Secret value: `{your-openai-api-key}`
- Secret ID: `database-url` → Secret value: `{your-database-url}`

**📝 Note:** If your bot needs additional secrets, add them to both Secret Manager and the `--set-secrets=` line in cloudbuild.yaml.

---

## 📦 Step 7: Create Artifact Registry Repository

1. **Go to Artifact Registry** (left sidebar)
2. **Click "CREATE REPOSITORY"**
3. **Configure repository:**
   - Name: `{namespace}` (use your actual namespace)
   - Format: `Docker`
   - Location type: `Region`
   - Region: `us-central1`
4. **Click "CREATE"**

---

## 🔑 Step 8: Grant Required Permissions

**Open Cloud Shell** (button in top-right corner of Google Cloud Console) and run these commands:

### 8.1 Set Your Variables

```bash
# Replace with your actual values
export NAMESPACE="your-namespace-here"
export PROJECT_ID="your-namespace-here"
export SERVICE_ACCOUNT_EMAIL="${NAMESPACE}@${PROJECT_ID}.iam.gserviceaccount.com"

# Verify your variables
echo "Namespace: $NAMESPACE"
echo "Project ID: $PROJECT_ID"
echo "Service Account: $SERVICE_ACCOUNT_EMAIL"
```

### 8.2 Grant Secret Manager Access

```bash
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${PROJECT_ID}-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

### 8.3 Grant Cloud Run Service Info Access

```bash
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${PROJECT_ID}-compute@developer.gserviceaccount.com" \
    --role="roles/run.viewer"
```

### 8.4 Allow Unauthenticated Access (for webhook endpoint)

```bash
# This will be applied after first deployment
# We'll run this command after Step 9
```

**📝 Note:** The unauthenticated access will be granted automatically by the deployment process.

---

## 🚀 Step 9: Deploy Your Bot

### 9.1 Commit and Push

```bash
# Add any changes you made to your repository
git add .

# Commit changes
git commit -m "Configure for Google Cloud Run deployment"

# Push to main branch (triggers automatic deployment)
git push origin main
```

### 9.2 Monitor Deployment

1. **Go to Cloud Build > History** in Google Cloud Console
2. **Watch your build progress** (takes 3-5 minutes)
3. **Check for any errors** in the build logs

### 9.3 Verify Deployment

```bash
# Get your bot URL
gcloud run services describe {namespace} --region=us-central1 --format="value(status.url)"

# Test health endpoint
curl https://your-bot-url.a.run.app/
```

---

## 🎉 Success! Your Bot is Live

### ✅ What You've Accomplished:

- **🤖 Telegram bot** running 24/7 on Google Cloud Run
- **🔄 Automatic deployments** on every git push
- **🔐 Secure secret management** with Google Secret Manager
- **📈 Auto-scaling** from 0 to 10 instances based on traffic
- **💰 Cost-optimized** infrastructure
- **🔗 Automatic webhook** setup and management

### 📊 Monitor Your Bot:

```bash
# View real-time logs
gcloud run logs tail {namespace} --region=us-central1

# Check service status
gcloud run services list

# View build history
# Go to Cloud Build > History in console
```

### 💡 Next Steps:

- **Test your bot** by sending `/start` on Telegram
- **Monitor costs** in Google Cloud Console > Billing
- **Set up alerts** for errors and cost thresholds
- **Add more features** and push to deploy automatically

---

## 🔧 Troubleshooting

### Common Issues:

**Bot not responding:**

```bash
# Check logs for errors
gcloud run logs tail {namespace} --region=us-central1

# Verify webhook is set
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

**Build failures:**

- Check Cloud Build > History for detailed error logs
- Verify all secrets exist in Secret Manager
- Ensure Docker and cloudbuild.yaml syntax is correct

**Permission errors:**

- Verify IAM permissions were granted correctly
- Check service account has access to secrets

---

## 💰 Expected Costs

**Typical monthly costs for a Telegram bot:**

- **Cloud Run**: $2-10 (depends on usage)
- **Cloud Build**: $1-5 (120 free build minutes/month)
- **Secret Manager**: $0.60 per secret per month
- **Artifact Registry**: $0.10/GB storage

**Total**: Usually $5-20/month for most bots

---

## 🎯 Summary

**Total setup time:** ~30 minutes  
**Manual commands:** Only 2 permission commands  
**Ongoing maintenance:** Zero - fully automated

Your Telegram bot is now running on enterprise-grade infrastructure with automatic scaling, secret management, and CI/CD. Every time you push code, it automatically deploys with zero downtime! 🚀
