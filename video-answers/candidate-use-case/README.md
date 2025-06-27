# Hireflix Interview Redirect Cloud Function

A Node.js Google Cloud Function that:

1. Validates the candidate (email / first name)  
2. Invites them to the correct Hireflix **position**  
3. Redirects the browser to the generated video-interview URL (or shows a friendly message if they were already invited)

---

## 📂 File Structure

video-answers/
└── candidate-use-case/
├── index.js # Cloud Function source
├── messages.js # i18n strings (EN / RU / IT)
└── package.json # Node.js dependencies & entry point

pgsql
Copy
Edit

---

## 🚀 Deploying

### 1 · Prepare Secrets

Store your secrets in **Codespaces Secrets** (or any CI secret store):

| Secret name          | Required | Purpose                         |
|----------------------|----------|---------------------------------|
| `HIREFLIX_API_KEY`   | ✔        | Your Hireflix API key           |
| `GCP_SA_KEY`         | ✔ ¹      | Base64-encoded GCP service-account JSON |

¹ Only needed when deploying from Codespaces or CI; skip on a local machine that’s already authenticated.

> You can still set an env var called `HIREFLIX_POSITION_ID` if you want a global fallback, but it’s not required — each HTTP call can pass its own `positionId` query parameter.

### 2 · Authenticate with Google Cloud

```bash
echo "$GCP_SA_KEY" | base64 -d > /tmp/gcp-key.json
gcloud auth activate-service-account --key-file=/tmp/gcp-key.json
rm /tmp/gcp-key.json

gcloud config set project YOUR_GCP_PROJECT_ID
3 · Deploy the Function
bash
Copy
Edit
cd video-answers/candidate-use-case   # or use --source=…

gcloud functions deploy interviewRedirect \
  --entry-point=interviewRedirect \
  --runtime=nodejs20 \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars HIREFLIX_API_KEY="$HIREFLIX_API_KEY"
(Replace $HIREFLIX_API_KEY with your secret if you’re deploying locally.)

🔗 Invoking
cpp
Copy
Edit
https://REGION-PROJECT.cloudfunctions.net/interviewRedirect?\
email=jane@example.com&firstName=Jane&positionId=685416df1f7c312434d514b6&language=russian
Param	Required	Purpose / Notes
email	✔	Candidate e-mail. Falls back to email_manual.
firstName	✔	Candidate first name. Falls back to first_name_manual.
positionId	✔ ²	Hireflix position ID.
lastName	✖	Forwarded to Hireflix if supplied.
language	✖	english (default) | russian | italian.

² If you prefer a single global position, set HIREFLIX_POSITION_ID in your Codespaces secrets and omit this param.

🛠 Troubleshooting
401 / 403 → Check HIREFLIX_API_KEY.

“package.json not found” → Ensure you deploy from the correct folder or pass --source.

Runtime deprecation warning → Redeploy with --runtime=nodejs20.

📄 MIT © starjourney
