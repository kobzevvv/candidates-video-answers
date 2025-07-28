# Hireflix Transcript Sync (Simplified)

Automatically fetch interview transcripts from Hireflix and store them in your Neon database.

## Quick Setup

### 1. Add GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions:

- `DATABASE_URL` - Your Neon database connection string
- `HIREFLIX_API_KEY` - Your Hireflix API key  
- `HIREFLIX_POSITION_ID` - Your position ID(s), comma-separated

### 2. That's it!

The system will automatically:
- Run every 4 hours to sync new transcripts
- Only process completed interviews
- Skip interviews already synced
- Store transcripts with word-level timestamps

## Manual Usage

### GitHub Action (Recommended)

1. Go to **Actions** → "Auto Sync Hireflix Transcripts"
2. Click **Run workflow**
3. Choose options:
   - **Position IDs**: Leave empty to use your default, or specify specific ones
   - **Sync Mode**: 
     - `incremental` - Only new interviews since last sync
     - `full` - All completed interviews (ignores last sync time)
     - `dry-run` - Show what would be synced without saving
4. Click **Run workflow**

### Local Development

```bash
cd scripts/transcript-sync
npm install

# Copy and edit environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL, API_KEY, etc.

# Setup database (first time only)
node setup-database.js

# Sync new transcripts
node hireflix-sync.js

# Full sync (all interviews)
node hireflix-sync.js --full

# Sync specific positions only
node hireflix-sync.js POSITION_ID_1 POSITION_ID_2
```

## How It Works

1. **Query Hireflix directly** for completed interviews by position
2. **Check timestamps** - only sync interviews updated since last run
3. **Fetch full transcripts** with word-level timing data
4. **Store in database** with proper relationships
5. **Update sync timestamp** for next incremental run

## Database Schema

- **interviews** - Basic interview info and candidate details
- **interview_questions** - Questions asked in each interview
- **interview_answers** - Answers with transcripts and word timestamps
- **sync_metadata** - Tracks last sync time for incremental updates

## Benefits of This Approach

✅ **Simple** - No complex Google Cloud Function integration needed  
✅ **Reliable** - Queries Hireflix API directly for ground truth  
✅ **Efficient** - Only syncs new/updated interviews  
✅ **Flexible** - Works with multiple positions and manual triggers  
✅ **Transparent** - Clear logs showing what's being synced  

## Troubleshooting

**No interviews found?**
- Check your `HIREFLIX_POSITION_ID` is correct
- Verify the position has completed interviews
- Make sure your API key has access to that position

**Sync failing?**
- Check GitHub Action logs for specific errors
- Verify all secrets are set correctly  
- Test with dry-run mode first

**Want to re-sync everything?**
- Use "full" sync mode to ignore timestamps
- Or manually clear the sync_metadata table

The system is designed to be simple and reliable - it gets interview data directly from Hireflix without needing to track anything in your other systems!