# Hireflix Video Interview Invite Cloud Function

This Google Cloud Function validates candidate data and creates an asynchronous interview in Hireflix. If the candidate info looks broken it redirects them to a fallback Typeform. Otherwise a status page with useful links is shown.

## File Structure

```
video-answers/candidate-use-case/
├── index.js      # Function source
├── messages.js   # i18n strings
├── package.json  # Node.js config
└── __tests__/    # Jest tests
```

## Deploying

### 1 · Prepare Secrets

Create the following GitHub secrets (or environment variables):

| Secret name         | Purpose                                |
|---------------------|----------------------------------------|
| `HIREFLIX_API_KEY`  | Your Hireflix API key                  |
| `GCP_SA_KEY`        | Base64‑encoded service account JSON    |
| `GCP_PROJECT_ID`    | Google Cloud project ID                |

`HIREFLIX_POSITION_ID` can also be provided as a secret if you want a default position.

### 2 · GitHub Action

Run the **Deploy Cloud Function** workflow and provide the `function_name` input. The workflow authenticates with Google Cloud and deploys the function using Node.js 20.

### Manual Deploy

```bash
cd video-answers/candidate-use-case
# authenticate with gcloud first

gcloud functions deploy video-interview-invite \
  --entry-point=videoInterviewInvite \
  --runtime=nodejs20 \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars HIREFLIX_API_KEY="$HIREFLIX_API_KEY"
```

### Invoking

```
https://REGION-PROJECT.cloudfunctions.net/video-interview-invite?email=jane@example.com&firstName=Jane&positionId=123
```

Optional params: `lastName`, `language` (`english`|`russian`|`italian`), `formId` (fallback Typeform), `tipsDoc` (Google Docs URL).

MIT © Starjourney
