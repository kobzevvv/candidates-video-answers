#!/bin/bash

# Monitor Google Cloud Function for evaluate-candidate

FUNCTION_NAME="evaluate-candidate"
REGION="us-central1"  # Update if your function is in a different region

echo "🔍 Monitoring Cloud Function: $FUNCTION_NAME"
echo "📍 Region: $REGION"
echo "📅 Time: $(date)"
echo ""

# Function to check if gcloud is installed
check_gcloud() {
  if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI is not installed"
    echo "   Install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
  fi
}

# Function to show recent logs
show_logs() {
  echo "📋 Recent Function Logs (last 50 entries):"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  gcloud functions logs read $FUNCTION_NAME \
    --region $REGION \
    --limit 50 \
    --format="table(time.date('%Y-%m-%d %H:%M:%S'), level, text)" || {
    echo "❌ Failed to fetch logs"
    echo "   Make sure you're authenticated: gcloud auth login"
  }
}

# Function to show function details
show_function_details() {
  echo ""
  echo "🔧 Function Configuration:"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  gcloud functions describe $FUNCTION_NAME \
    --region $REGION \
    --format="yaml(name,runtime,timeout,availableMemoryMb,maxInstances,minInstances,environmentVariables,httpsTrigger.url)" || {
    echo "❌ Failed to describe function"
  }
}

# Function to show metrics
show_metrics() {
  echo ""
  echo "📊 Function Metrics (last hour):"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  # Get metrics for the last hour
  END_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    START_TIME=$(date -u -v-1H +"%Y-%m-%dT%H:%M:%SZ")
  else
    # Linux
    START_TIME=$(date -u -d '1 hour ago' +"%Y-%m-%dT%H:%M:%SZ")
  fi
  
  echo "📈 Execution count:"
  gcloud monitoring read \
    "cloudfunctions.googleapis.com/function/execution_count" \
    --start-time="$START_TIME" \
    --end-time="$END_TIME" \
    --filter="resource.labels.function_name=\"$FUNCTION_NAME\"" \
    --format="table(point.value.int64_value,point.interval.end_time.seconds.date('%H:%M'))" 2>/dev/null || {
    echo "   No execution data available"
  }
  
  echo ""
  echo "⚠️  Error count:"
  gcloud monitoring read \
    "cloudfunctions.googleapis.com/function/error_count" \
    --start-time="$START_TIME" \
    --end-time="$END_TIME" \
    --filter="resource.labels.function_name=\"$FUNCTION_NAME\"" \
    --format="table(point.value.int64_value,point.interval.end_time.seconds.date('%H:%M'))" 2>/dev/null || {
    echo "   No error data available"
  }
}

# Function to tail logs in real-time
tail_logs() {
  echo ""
  echo "🔄 Tailing logs in real-time (Ctrl+C to stop):"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  gcloud functions logs read $FUNCTION_NAME \
    --region $REGION \
    --limit 10 \
    --format="table(time.date('%Y-%m-%d %H:%M:%S'), level, text)"
  
  echo ""
  echo "Watching for new logs..."
  gcloud alpha functions logs tail $FUNCTION_NAME --region $REGION 2>/dev/null || {
    echo "⚠️  Real-time tailing not available. Showing recent logs instead."
    watch -n 5 "gcloud functions logs read $FUNCTION_NAME --region $REGION --limit 10"
  }
}

# Main menu
main() {
  check_gcloud
  
  if [ "$1" == "tail" ]; then
    tail_logs
    exit 0
  fi
  
  if [ "$1" == "logs" ]; then
    show_logs
    exit 0
  fi
  
  # Default: show everything
  show_function_details
  echo ""
  show_metrics
  echo ""
  show_logs
  
  echo ""
  echo "💡 Additional commands:"
  echo "   $0 logs  - Show only recent logs"
  echo "   $0 tail  - Tail logs in real-time"
  echo ""
  echo "🔍 To search for specific errors:"
  echo "   gcloud functions logs read $FUNCTION_NAME --region $REGION --filter 'textPayload:\"timeout\"'"
  echo "   gcloud functions logs read $FUNCTION_NAME --region $REGION --filter 'textPayload:\"429\"'"
  echo ""
  echo "📊 To check billing/usage:"
  echo "   Visit: https://console.cloud.google.com/functions/details/$REGION/$FUNCTION_NAME"
}

# Run main function with arguments
main "$@"