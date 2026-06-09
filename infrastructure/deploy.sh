#!/usr/bin/env bash
set -euo pipefail

REGION="${AWS_REGION:-us-west-2}"
STACK_NAME="${STACK_NAME:-bunkerguard-ai}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$ROOT_DIR/.build/lambda"
ZIP_PATH="$ROOT_DIR/.build/bunkerguard-lambda.zip"

required_vars=(
  BEDROCK_MODEL_ID
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
)
for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "Missing required environment variable: $var_name" >&2
    exit 1
  fi
done

ACCOUNT_ID="$(AWS_DEFAULT_REGION="$REGION" aws sts get-caller-identity --query Account --output text)"
DEPLOYMENT_BUCKET="${DEPLOYMENT_BUCKET:-bunkerguard-ai-deploy-${ACCOUNT_ID}-${REGION}}"
DEPLOYMENT_KEY="lambda/$(date -u +%Y%m%dT%H%M%SZ)-bunkerguard.zip"

if ! AWS_DEFAULT_REGION="$REGION" aws s3api head-bucket --bucket "$DEPLOYMENT_BUCKET" 2>/dev/null; then
  AWS_DEFAULT_REGION="$REGION" aws s3api create-bucket \
    --bucket "$DEPLOYMENT_BUCKET" \
    --region "$REGION" \
    --create-bucket-configuration "LocationConstraint=$REGION"
fi

rm -rf "$BUILD_DIR" "$ZIP_PATH"
mkdir -p "$BUILD_DIR"

python3 -m pip install \
  --requirement "$ROOT_DIR/backend/requirements-lambda.txt" \
  --target "$BUILD_DIR" \
  --platform manylinux2014_x86_64 \
  --implementation cp \
  --python-version 3.12 \
  --only-binary=:all:

cp -R \
  "$ROOT_DIR/backend/anomaly" \
  "$ROOT_DIR/backend/contracts" \
  "$ROOT_DIR/backend/ingestion" \
  "$ROOT_DIR/backend/llm" \
  "$ROOT_DIR/backend/policy" \
  "$ROOT_DIR/backend/risk" \
  "$BUILD_DIR/"
cp "$ROOT_DIR/backend/lambda_app.py" "$ROOT_DIR/backend/storage.py" "$BUILD_DIR/"
rm -f "$BUILD_DIR"/contracts/keys/*.priv

(
  cd "$BUILD_DIR"
  zip -qr "$ZIP_PATH" .
)

AWS_DEFAULT_REGION="$REGION" aws s3 cp "$ZIP_PATH" "s3://$DEPLOYMENT_BUCKET/$DEPLOYMENT_KEY"

AWS_DEFAULT_REGION="$REGION" aws cloudformation deploy \
  --region "$REGION" \
  --stack-name "$STACK_NAME" \
  --template-file "$ROOT_DIR/infrastructure/template.yaml" \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    "DeploymentBucket=$DEPLOYMENT_BUCKET" \
    "DeploymentKey=$DEPLOYMENT_KEY" \
    "BedrockModelId=$BEDROCK_MODEL_ID" \
    "ExaApiKey=${EXA_API_KEY:-}" \
    "SupabaseUrl=$SUPABASE_URL" \
    "SupabaseServiceRoleKey=$SUPABASE_SERVICE_ROLE_KEY" \
    "AnthropicApiKey=${ANTHROPIC_API_KEY:-}" \
    "OpenRouterApiKey=${OPENROUTER_API_KEY:-}" \
    "OpenRouterModel=${OPENROUTER_MODEL:-anthropic/claude-sonnet-4.6}" \
    "CorsOrigin=${CORS_ORIGIN:-https://bunkerguard-ai.vercel.app}"

AWS_DEFAULT_REGION="$REGION" aws cloudformation describe-stacks \
  --region "$REGION" \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs' \
  --output table
