# CI Deploy Cloud Function Secrets

The `Deploy Cloud Function` workflow requires several GitHub secrets for authentication and environment variables. Without these, the `google-github-actions/auth` step fails with an error about `workload_identity_provider` or `credentials_json`.

## Required Secrets

- **`GCP_SA_KEY`** – Base64‑encoded service account JSON used by the `google-github-actions/auth` action.
- **`GCP_PROJECT_ID`** – Your Google Cloud project ID.
- **`HIREFLIX_API_KEY`** – Hireflix API key passed as an environment variable during deploy.

Optional:

- **`HIREFLIX_POSITION_ID`** – Default Hireflix position ID.

Add these in **Settings → Secrets and variables → Actions** of your repository. The deploy workflow references them as shown below:

```yaml
- uses: google-github-actions/auth@v1
  with:
    credentials_json: ${{ secrets.GCP_SA_KEY }}
- uses: google-github-actions/setup-gcloud@v1
  with:
    project_id: ${{ secrets.GCP_PROJECT_ID }}
- name: Deploy
  run: |
    gcloud functions deploy ${{ github.event.inputs.function_name }} \
      --set-env-vars HIREFLIX_API_KEY=${{ secrets.HIREFLIX_API_KEY }}
```

Once these secrets are configured, trigger the **Deploy Cloud Function** workflow from the Actions tab and provide the `function_name` input.
