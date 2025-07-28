# Integration with Google Cloud Function

To enable automatic transcript syncing, you need to track interview IDs when they're created.

## Option 1: Update Your Google Cloud Function

Modify your `video-answers/candidate-use-case/index.js` to store interview IDs:

### 1. Update the GraphQL mutation to request the ID

```javascript
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
        id              # ← Add this line to get the interview ID
        url { public }
      }
      ... on InterviewAlreadyExistsInPositionError {
        message
      }
    }
  }
`;
```

### 2. Store the interview ID for tracking

```javascript
const payload = data?.data?.inviteCandidateToInterview;
const publicUrl = payload?.url?.public;
const interviewId = payload?.id;  // ← Get the interview ID

// Store interview ID for later syncing
if (interviewId) {
  console.log('Interview ID:', interviewId);
  
  // Option A: Store in your existing database
  // You could add this to your Neon database for tracking
  
  // Option B: Log for manual collection
  console.log('INTERVIEW_CREATED:', JSON.stringify({
    id: interviewId,
    email: email,
    firstName: firstName,
    lastName: lastName,
    positionId: positionId,
    timestamp: new Date().toISOString()
  }));
}
```

### 3. Add database integration (recommended)

If you want to store interview IDs directly in your database from the Cloud Function:

```javascript
// Add at the top of your Cloud Function
const { Client } = require('pg');

// After getting the interview ID
if (interviewId) {
  try {
    const client = new Client({
      connectionString: process.env.DATABASE_URL  // Add this env var
    });
    
    await client.connect();
    
    await client.query(`
      INSERT INTO interviews (
        id, candidate_email, candidate_first_name, candidate_last_name, 
        position_id, status, created_at, updated_at
      ) 
      VALUES ($1, $2, $3, $4, $5, 'invited', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `, [interviewId, email, firstName, lastName, positionId]);
    
    await client.end();
    console.log('Stored interview ID for tracking');
  } catch (error) {
    console.error('Error storing interview ID:', error);
    // Don't fail the main function if tracking fails
  }
}
```

## Option 2: Use Hireflix Webhooks (Advanced)

Set up a webhook endpoint to receive `interview.finish` events:

### 1. Create webhook endpoint

```javascript
// New webhook endpoint (e.g., webhook-handler.js)
exports.handleHireflixWebhook = async (req, res) => {
  const { event, data } = req.body;
  
  if (event === 'interview.finish') {
    const interviewId = data.interview.id;
    
    // Mark interview as completed and trigger sync
    const InterviewTracker = require('./store-interview-id.js');
    const tracker = new InterviewTracker(process.env.DATABASE_URL);
    
    await tracker.markInterviewCompleted(interviewId);
    
    // Optionally trigger immediate sync
    // You could call the sync script here or let the scheduled job handle it
  }
  
  res.status(200).send('OK');
};
```

### 2. Configure in Hireflix dashboard

- Set webhook URL to your endpoint
- Subscribe to `interview.finish` events

## Option 3: Manual Interview ID Collection

If automatic integration is complex, you can collect interview IDs manually:

### 1. From Cloud Function logs

Search your Cloud Function logs for "Interview ID:" entries and collect them.

### 2. From database queries

If you have a separate tracking database, query for recent interviews.

### 3. From Hireflix dashboard

Use the Hireflix API to query recent interviews by position.

## Required Environment Variables

Add to your GitHub repository secrets:

- `DATABASE_URL` - Your Neon database connection
- `HIREFLIX_API_KEY` - Your Hireflix API key  
- `HIREFLIX_POSITION_ID` - (Optional) Default position ID for querying

## Testing the Integration

1. **Create a test interview** using your current flow
2. **Check the logs** to see if the interview ID is captured
3. **Run the sync manually** to verify transcripts can be fetched
4. **Enable the scheduled job** for automatic syncing

The GitHub Action will run every 4 hours and sync any new completed interviews automatically!