#!/bin/bash

# Telegram Bot Deployment Script for Google Cloud App Engine
# Run this script in Google Cloud Shell

set -e  # Exit on any error

echo "🚀 Starting Telegram Bot Deployment to Google Cloud App Engine"
echo "================================================================"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Function to create or update secret
create_or_update_secret() {
    local secret_name=$1
    local secret_value=$2
    
    if gcloud secrets describe $secret_name &>/dev/null; then
        print_info "Updating existing secret: $secret_name"
        echo -n "$secret_value" | gcloud secrets versions add $secret_name --data-file=-
    else
        print_info "Creating new secret: $secret_name"
        echo -n "$secret_value" | gcloud secrets create $secret_name --data-file=-
    fi
}

# Function to parse .env file content
parse_env_content() {
    local env_content="$1"
    local line_num=0
    
    while IFS= read -r line || [[ -n "$line" ]]; do
        line_num=$((line_num + 1))
        
        # Skip empty lines
        [[ -z "${line// }" ]] && continue
        
        # Skip comment lines (starting with #)
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        
        # Remove inline comments (everything after # but preserve # in values within quotes)
        if [[ "$line" =~ ^([^#]*)(#.*)?$ ]]; then
            line="${BASH_REMATCH[1]}"
        fi
        
        # Check if line contains =
        if [[ "$line" =~ ^[[:space:]]*([^=]+)=(.*)$ ]]; then
            local key="${BASH_REMATCH[1]}"
            local value="${BASH_REMATCH[2]}"
            
            # Trim whitespace from key
            key=$(echo "$key" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
            
            # Trim whitespace from value
            value=$(echo "$value" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
            
            # Remove surrounding quotes (single or double)
            if [[ "$value" =~ ^\"(.*)\"$ ]] || [[ "$value" =~ ^\'(.*)\'$ ]]; then
                value="${BASH_REMATCH[1]}"
            fi
            
            # Skip if key is empty
            [[ -z "$key" ]] && continue
            
            echo "Found: $key"
            
            # Ask if this should be a secret or regular env var
            while true; do
                read -p "Is '$key' a secret/sensitive value? (y/n): " is_secret </dev/tty
                case $is_secret in
                    [Yy]* )
                        # Convert to lowercase with hyphens for Secret Manager
                        secret_id=$(echo "$key" | tr '[:upper:]' '[:lower:]' | tr '_' '-')
                        SECRET_VARS["$key"]="$secret_id"
                        print_info "Creating/updating secret: $secret_id"
                        create_or_update_secret "$secret_id" "$value"
                        print_status "Secret '$key' configured!"
                        break
                        ;;
                    [Nn]* )
                        ENV_VARS["$key"]="$value"
                        print_status "Environment variable '$key' configured!"
                        break
                        ;;
                    * )
                        print_error "Please answer yes (y) or no (n)."
                        ;;
                esac
            done
        else
            print_warning "Skipping invalid line $line_num: $line"
        fi
    done <<< "$env_content"
}

# Get project information
PROJECT_ID=$(gcloud config get-value project)
if [ -z "$PROJECT_ID" ]; then
    print_error "No project selected. Please run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

print_info "Current project: $PROJECT_ID"
DEPLOYMENT_URL="https://${PROJECT_ID}.uc.r.appspot.com"

echo ""
echo "Step 1: Enable required APIs"
echo "=============================="

# Enable required APIs
print_info "Enabling App Engine Admin API..."
gcloud services enable appengine.googleapis.com

print_info "Enabling Secret Manager API..."
gcloud services enable secretmanager.googleapis.com

print_info "Enabling Cloud Build API..."
gcloud services enable cloudbuild.googleapis.com

print_status "Required APIs enabled"

echo ""
echo "Step 2: Create App Engine application"
echo "====================================="

# Check if App Engine app exists
if ! gcloud app describe &>/dev/null; then
    print_info "App Engine application not found. Creating one..."
    echo "Available regions:"
    echo "- us-central (Iowa)"
    echo "- us-east1 (South Carolina)"  
    echo "- europe-west (Belgium)"
    echo "- asia-northeast1 (Tokyo)"
    echo "- For full list: https://cloud.google.com/appengine/docs/locations"
    
    read -p "Enter your preferred region (e.g., us-central): " REGION
    gcloud app create --region=$REGION
    print_status "App Engine application created in $REGION"
else
    print_status "App Engine application already exists"
fi

echo ""
echo "Step 3: Set up Secret Manager for environment variables"
echo "========================================================"

# Collect environment variables
echo "🔐 Environment Variables & Secrets Setup"
echo "========================================"
echo ""
print_info "We'll now set up your environment variables securely using Secret Manager."
echo ""

# Arrays to store environment variables
declare -A ENV_VARS
declare -A SECRET_VARS

while true; do
    echo ""
    echo "Choose an option:"
    echo "1. Add/Update a secret (sensitive data like API keys, tokens)"
    echo "2. Add/Update a regular environment variable"
    echo "3. Parse .env file content (paste your .env file contents)"
    echo "4. List all configured variables"
    echo "5. Continue with deployment"
    echo ""
    read -p "Enter your choice (1-5): " choice
    
    case $choice in
        1)
            echo ""
            read -p "Enter secret name (e.g., BOT_TOKEN, OPENAI_API_KEY): " secret_name
            if [ -z "$secret_name" ]; then
                print_error "Secret name cannot be empty!"
                continue
            fi
            
            read -s -p "Enter secret value: " secret_value
            echo ""
            if [ -z "$secret_value" ]; then
                print_error "Secret value cannot be empty!"
                continue
            fi
            
            # Convert to lowercase with hyphens for Secret Manager
            secret_id=$(echo "$secret_name" | tr '[:upper:]' '[:lower:]' | tr '_' '-')
            SECRET_VARS["$secret_name"]="$secret_id"
            
            print_info "Creating/updating secret: $secret_id"
            create_or_update_secret "$secret_id" "$secret_value"
            print_status "Secret '$secret_name' configured successfully!"
            ;;
        2)
            echo ""
            read -p "Enter environment variable name: " env_name
            if [ -z "$env_name" ]; then
                print_error "Environment variable name cannot be empty!"
                continue
            fi
            
            read -p "Enter environment variable value: " env_value
            if [ -z "$env_value" ]; then
                print_error "Environment variable value cannot be empty!"
                continue
            fi
            
            ENV_VARS["$env_name"]="$env_value"
            print_status "Environment variable '$env_name' configured!"
            ;;
        3)
            echo ""
            print_info "📄 Paste your .env file content below."
            print_info "When finished, type 'END_ENV' on a new line and press Enter."
            echo ""
            echo "Example format:"
            echo "# Database configuration"
            echo "DATABASE_URL=\"postgresql://user:pass@host:5432/db\""
            echo "BOT_TOKEN=123456789:ABCdefGHijklMNopqrsTUvwxyz"
            echo "OPENAI_API_KEY='sk-1234567890abcdef' # OpenAI API key"
            echo ""
            print_warning "Paste your content now:"
            
            # Read multi-line input until END_ENV
            env_content=""
            while IFS= read -r line; do
                if [[ "$line" == "END_ENV" ]]; then
                    break
                fi
                env_content+="$line"$'\n'
            done
            
            if [ -z "$env_content" ]; then
                print_error "No content provided!"
                continue
            fi
            
            print_info "Parsing .env content..."
            parse_env_content "$env_content"
            print_status ".env file parsing completed!"
            ;;
        4)
            echo ""
            print_info "📋 Configured Variables:"
            echo "========================"
            
            if [ ${#SECRET_VARS[@]} -gt 0 ]; then
                echo ""
                echo "🔐 Secrets (stored in Secret Manager):"
                for secret_name in "${!SECRET_VARS[@]}"; do
                    echo "  $secret_name -> ${SECRET_VARS[$secret_name]}"
                done
            fi
            
            if [ ${#ENV_VARS[@]} -gt 0 ]; then
                echo ""
                echo "🌍 Environment Variables:"
                for env_name in "${!ENV_VARS[@]}"; do
                    echo "  $env_name = ${ENV_VARS[$env_name]}"
                done
            fi
            
            # Always show DEPLOYMENT_URL
            echo ""
            echo "🌐 Auto-configured:"
            echo "  DEPLOYMENT_URL = $DEPLOYMENT_URL"
            
            if [ ${#SECRET_VARS[@]} -eq 0 ] && [ ${#ENV_VARS[@]} -eq 0 ]; then
                print_warning "No variables configured yet!"
            fi
            ;;
        5)
            # Validate required variables
            if [[ ! " ${!SECRET_VARS[@]} " =~ " BOT_TOKEN " ]]; then
                print_error "BOT_TOKEN is required! Please add it as a secret."
                continue
            fi
            
            print_status "Environment variables configuration complete!"
            break
            ;;
        *)
            print_error "Invalid choice! Please enter 1-5."
            ;;
    esac
done

print_status "Secrets created in Secret Manager"

echo ""
echo "Step 4: Configure app.yaml with your environment variables"
echo "=========================================================="

# Check if app.yaml exists in the repository
if [ -f "app.yaml" ]; then
    print_info "Found existing app.yaml in repository. Using it as base configuration."
    
    # Create a backup of the original
    cp app.yaml app.yaml.backup
    print_info "Created backup: app.yaml.backup"
    
    # Check if DEPLOYMENT_URL is already set
    if ! grep -q "DEPLOYMENT_URL" app.yaml; then
        print_info "Adding DEPLOYMENT_URL to existing app.yaml..."
        
        # Add DEPLOYMENT_URL to env_variables section
        if grep -q "env_variables:" app.yaml; then
            # env_variables section exists, add DEPLOYMENT_URL to it
            sed -i "/env_variables:/a\\  DEPLOYMENT_URL: \"$DEPLOYMENT_URL\"" app.yaml
        else
            # No env_variables section, create one
            cat >> app.yaml << EOF

# Environment variables (added by deployment script)
env_variables:
  DEPLOYMENT_URL: "$DEPLOYMENT_URL"
EOF
        fi
    else
        # Update existing DEPLOYMENT_URL
        sed -i "s|DEPLOYMENT_URL:.*|DEPLOYMENT_URL: \"$DEPLOYMENT_URL\"|" app.yaml
        print_info "Updated DEPLOYMENT_URL in existing app.yaml"
    fi
    
    # Add regular environment variables to existing app.yaml
    if [ ${#ENV_VARS[@]} -gt 0 ]; then
        print_info "Adding ${#ENV_VARS[@]} environment variables to app.yaml..."
        for env_name in "${!ENV_VARS[@]}"; do
            if grep -q "^[[:space:]]*${env_name}:" app.yaml; then
                # Update existing variable
                sed -i "s|${env_name}:.*|${env_name}: \"${ENV_VARS[$env_name]}\"|" app.yaml
            else
                # Add new variable to env_variables section
                sed -i "/env_variables:/a\\  ${env_name}: \"${ENV_VARS[$env_name]}\"" app.yaml
            fi
        done
    fi
    
else
    print_warning "No app.yaml found in repository. Creating a new one..."
    
    # Generate app.yaml from scratch
    cat > app.yaml << EOF
runtime: nodejs20

# Automatic scaling configuration
automatic_scaling:
  min_instances: 1
  max_instances: 10
  target_cpu_utilization: 0.6

# Environment variables
env_variables:
  NODE_ENV: production
  DEPLOYMENT_URL: "$DEPLOYMENT_URL"
EOF

    # Add regular environment variables
    for env_name in "${!ENV_VARS[@]}"; do
        echo "  $env_name: \"${ENV_VARS[$env_name]}\"" >> app.yaml
    done

    cat >> app.yaml << EOF

# Resource allocation
resources:
  cpu: 1
  memory_gb: 0.5
  disk_size_gb: 10

# Health check configuration
readiness_check:
  path: "/"
  check_interval_sec: 5
  timeout_sec: 4
  failure_threshold: 2
  success_threshold: 2
  app_start_timeout_sec: 300

liveness_check:
  path: "/"
  check_interval_sec: 30
  timeout_sec: 4
  failure_threshold: 2
  success_threshold: 2

# Network configuration
network:
  session_affinity: true
EOF
fi

# Add secret manager configuration if there are secrets
if [ ${#SECRET_VARS[@]} -gt 0 ]; then
    print_info "Adding Secret Manager configuration for ${#SECRET_VARS[@]} secrets..."
    
    # Check if includes section already exists
    if ! grep -q "includes:" app.yaml; then
        cat >> app.yaml << EOF

# Secret Manager configuration (added by deployment script)
includes:
  - secret_env_variables.yaml
EOF
    elif ! grep -q "secret_env_variables.yaml" app.yaml; then
        sed -i "/includes:/a\\  - secret_env_variables.yaml" app.yaml
    fi

    # Create secret environment variables file
    cat > secret_env_variables.yaml << EOF
# This file is generated by the deployment script
# It contains references to secrets stored in Google Secret Manager
env_variables:
EOF

    # Add all secrets to the configuration
    for secret_name in "${!SECRET_VARS[@]}"; do
        secret_id="${SECRET_VARS[$secret_name]}"
        cat >> secret_env_variables.yaml << EOF
  $secret_name:
    secret_id: "$secret_id"
    version: "latest"
EOF
    done
    
    print_status "app.yaml configured with ${#SECRET_VARS[@]} secrets and ${#ENV_VARS[@]} environment variables"
else
    print_status "app.yaml configured with ${#ENV_VARS[@]} environment variables (no secrets)"
fi

print_info "Final app.yaml configuration:"
echo "================================"
cat app.yaml | head -20
if [ $(wc -l < app.yaml) -gt 20 ]; then
    echo "... (truncated, full file has $(wc -l < app.yaml) lines)"
fi

echo ""
echo "Step 5: Verify deployment files"
echo "================================"

# Check for required files
if [ ! -f ".gcloudignore" ]; then
    print_warning ".gcloudignore not found in repository!"
    print_info "Please ensure you have a .gcloudignore file to exclude unnecessary files from deployment."
    print_info "You can use the template provided in the deployment guide."
fi

if [ ! -f "package.json" ]; then
    print_error "package.json not found! This is required for Node.js deployment."
    exit 1
fi

print_status "Deployment files verification completed"

echo ""
echo "Step 6: Grant App Engine access to Secret Manager"
echo "=================================================="

# Get App Engine service account
APP_ENGINE_SA="${PROJECT_ID}@appspot.gserviceaccount.com"

print_info "Granting Secret Manager access to App Engine service account..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${APP_ENGINE_SA}" \
    --role="roles/secretmanager.secretAccessor"

print_status "Secret Manager access granted to App Engine"

echo ""
echo "Step 7: Update package.json scripts"
echo "===================================="

# Check if package.json exists and update it
if [ -f "package.json" ]; then
    print_info "Checking package.json scripts..."
    
    # Use jq to update package.json if available, otherwise provide manual instructions
    if command -v jq &> /dev/null; then
        # Add start script if it doesn't exist
        jq '.scripts.start = "node index.js"' package.json > package.json.tmp && mv package.json.tmp package.json
        print_status "package.json updated with start script"
    else
        print_warning "Please ensure your package.json has a 'start' script:"
        echo '  "scripts": {'
        echo '    "start": "node index.js"'
        echo '  }'
    fi
else
    print_warning "package.json not found. Please ensure it exists with proper scripts."
fi

echo ""
echo "Step 8: Deploy to App Engine"
echo "============================="

print_info "Starting deployment..."
print_warning "This may take a few minutes..."

# Deploy with automatic promotion
gcloud app deploy --quiet --promote

if [ $? -eq 0 ]; then
    print_status "Deployment successful!"
else
    print_error "Deployment failed!"
    exit 1
fi

echo ""
echo "Step 9: Verify deployment"
echo "========================="

# Get the app URL
APP_URL=$(gcloud app browse --no-launch-browser)
print_info "Your bot is deployed at: $APP_URL"

# Test the health endpoint
print_info "Testing health endpoint..."
curl -s "$APP_URL" && print_status "Health check passed" || print_warning "Health check failed"

echo ""
echo "Step 10: Monitor your bot"
echo "========================="

print_info "Useful commands for monitoring:"
echo "  View logs:     gcloud app logs tail -s default"
echo "  View app:      gcloud app browse"
echo "  App versions:  gcloud app versions list"
echo "  Stop version:  gcloud app versions stop VERSION_ID"

echo ""
print_status "🎉 Deployment Complete!"
print_info "Your Telegram bot is now running on Google Cloud App Engine"
print_info "Bot URL: $APP_URL"
print_info "Webhook URL: ${APP_URL}/webhook/telegram/[BOT_TOKEN]"
print_info "Deployment URL (env var): $DEPLOYMENT_URL"

echo ""
echo "Next Steps:"
echo "==========="
echo "1. Test your bot by sending /start command"
echo "2. Monitor logs: gcloud app logs tail -s default"
echo "3. Check App Engine console for metrics"
echo "4. Set up monitoring alerts if needed"

echo ""
print_warning "Important Security Notes:"
echo "- Your secrets are stored in Secret Manager"
echo "- Never commit secrets to your repository"
echo "- Regularly rotate your API keys"
echo "- Monitor access logs for suspicious activity"