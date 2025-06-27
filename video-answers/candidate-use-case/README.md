# Hireflix Interview Redirect Cloud Function

This folder contains a Node.js Google Cloud Function that invites a candidate to a Hireflix video interview and then redirects the candidate to the generated interview URL.

## Deploying

1. Create a `.env.yaml` file with your Hireflix API key:

```yaml
HIREFLIX_API_KEY: "YOUR_HIREFLIX_API_KEY"
```

2. Deploy the function with `gcloud`:

```bash
gcloud functions deploy interviewRedirect \
  --runtime=nodejs18 \
  --trigger-http \
  --env-vars-file=.env.yaml \
  --entry-point=interviewRedirect
```

After deployment you can call the function using:

```
https://YOUR_FUNCTION_URL?email=jane@example.com&firstName=Jane&lastName=Doe
```

The page will check the candidate profile, invite them to Hireflix and redirect them to the video interview.
