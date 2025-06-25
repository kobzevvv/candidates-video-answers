# 📄 Candidate Self-Evaluation Form

This module generates a dynamic Typeform-based self-evaluation form for job applicants based on the job description and must-have requirements.

It is the first step in the candidate journey, and its goal is to:
- Filter out candidates who clearly don’t meet the core requirements
- Collect structured, reviewable data about each applicant
- Give motivated candidates a seamless experience before moving to the quiz stage

---

## 🧱 Components (Workflows)

Each step is implemented as an independent `n8n` workflow for modularity and reliability.

### 1. `generate-musthave-questions`
- Input: plain-text `must_haves` list
- Output: structured question list
- Model: GPT-3.5
- Constraints: only `multiple_choice` or `number` question types

---

### 2. `generate-base-typeform-json`
- Input: structured question list
- Output: valid Typeform JSON with:
  - title
  - welcome screen
  - all must-have questions
  - thank-you screen
- Handles API errors and retries with the same model

---

### 3. `add-salary-logic-branching`
- Adds conditional logic:
  - If salary expectation > budget → ask: "Our budget is up to X, are you still interested?"
  - Otherwise, do not show the budget
- Triggered only when a salary cap is defined
- Uses GPT-4 if GPT-3.5 fails to correctly generate logic

---

### 4. `append-nice-to-have-questions`
- Adds extra questions to enrich the candidate profile
- Question type: `multiple_choice` with `allow_multiple_selection: true`
- Always includes `"Other"` option
- Ordered logically after related must-have questions

---

### 5. `validate-and-deploy-final-form`
- Performs final JSON checks:
  - Salary logic correctness
  - Language-specific contact fields (Telegram vs LinkedIn)
  - Email presence
- Deploys working form to Typeform and returns shareable `form_url`

---

## 🛠 Local Development

- Test each `.n8n.json` workflow individually in `n8n`
- Store draft prompts and notes in each module folder (`README_todo.md`)
- Final JSONs can be versioned locally as `v1_output.json`, etc.

---

## 🔄 Workflow Chain Summary

```plaintext
generate-musthave-questions
    ↓
generate-base-typeform-json
    ↓
add-salary-logic-branching (optional)
    ↓
append-nice-to-have-questions
    ↓
validate-and-deploy-final-form
