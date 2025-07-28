# Hireflix Transcript Sync

This system fetches interview transcripts from Hireflix and stores them in your Neon database.

## Setup

### 1. Database Setup

First, make sure you have the required environment variables:

```bash
# Add to your GitHub repository secrets
DATABASE_URL=postgresql://neondb_owner:npg_EfROwd2s4Pgu@ep-aged-mouse-ab3hsik6-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
HIREFLIX_API_KEY=your_hireflix_api_key
```

### 2. GitHub Secrets Setup

**IMPORTANT**: The GitHub Action won't work without these secrets!

**Step-by-step setup:**

1. **Go to your GitHub repository**
2. **Click Settings** (in the repository, not your account)
3. **Click "Secrets and variables"** in the left sidebar
4. **Click "Actions"**
5. **Click "New repository secret"** and add each secret:

**Secret 1: DATABASE_URL**
- Name: `DATABASE_URL`
- Value: `postgresql://neondb_owner:npg_EfROwd2s4Pgu@ep-aged-mouse-ab3hsik6-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require`

**Secret 2: HIREFLIX_API_KEY**
- Name: `HIREFLIX_API_KEY`
- Value: Your actual Hireflix API key (get from Hireflix dashboard)

**To verify secrets are set:**
- Go to Settings → Secrets and variables → Actions
- You should see both `DATABASE_URL` and `HIREFLIX_API_KEY` listed

## Usage

### GitHub Action (Recommended)

1. Go to **Actions** tab in your GitHub repository
2. Find "Sync Hireflix Transcripts" workflow
3. Click **Run workflow**
4. Enter comma-separated interview IDs (e.g., `WFkJhaGk,ABC123,XYZ789`)
5. Choose dry run mode to test first
6. Click **Run workflow**

### Local Development

```bash
cd scripts/transcript-sync
npm install

# Copy environment template and fill in your credentials
cp .env.example .env
# Edit .env with your actual DATABASE_URL and HIREFLIX_API_KEY

# Setup database (first time only)
node setup-database.js

# Sync specific interviews
node sync-transcripts.js WFkJhaGk ABC123 XYZ789

# Or use environment variable from .env file
INTERVIEW_IDS="WFkJhaGk,ABC123" node sync-transcripts.js
```

## Database Schema

The system creates three tables:

- **interviews**: Main interview records
- **interview_questions**: Questions for each interview  
- **interview_answers**: Answers with transcripts and word-level timestamps

## Getting Interview IDs

You need to modify your existing Google Cloud Function to store interview IDs:

```javascript
// In your video-answers/candidate-use-case/index.js
// Update the GraphQL mutation to request the ID:

const query = `
  mutation InviteCandidateToInterview {
    inviteCandidateToInterview(
      input: {
        candidate: { ${candidateFields} },
        positionId: "${positionId}"
      }
    ) {
      __typename
      ... on InterviewType {
        id              # ← Add this line
        url { public }
      }
      ... on InterviewAlreadyExistsInPositionError {
        message
      }
    }
  }
`;

// After successful API call, log or store the ID:
const interviewId = payload?.id;
if (interviewId) {
  console.log('Interview ID:', interviewId);
  // You could store this in a database or file for later syncing
}
```

## Webhook Setup (Optional)

For automatic syncing, you can set up a Hireflix webhook:

1. Configure webhook URL in Hireflix dashboard
2. Listen for `interview.finish` events
3. Extract interview ID and trigger sync

## Features

- ✅ Fetches full transcripts with word-level timestamps
- ✅ Stores video URLs (note: they expire after ~14 days)
- ✅ Handles multiple interviews in batch
- ✅ Dry run mode for testing
- ✅ Manual GitHub Action triggering
- ✅ Proper error handling and logging
- ✅ Database schema with indexes

## Troubleshooting

**Common Issues:**

1. **"Interview not found"** - Check if the interview ID is correct
2. **"No transcripts"** - Make sure your Hireflix plan includes transcriptions
3. **Database connection errors** - Verify your `DATABASE_URL` format
4. **API errors** - Check your `HIREFLIX_API_KEY` permissions

**Logs:**
- GitHub Action logs show detailed progress
- Local runs show real-time sync status