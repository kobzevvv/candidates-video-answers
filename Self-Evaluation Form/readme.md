# 📄 Candidate Self-Evaluation Form

This module generates a dynamic Typeform-based self-evaluation form for job applicants based on the job description and must-have requirements.

It is the first step in the candidate journey, and its goal is to:
- Filter out candidates who clearly don’t meet the core requirements
- Collect structured, reviewable data about each applicant
- Give motivated candidates a seamless experience before moving to the quiz stage

---

## 🧱 Components (Workflows)

Each step is implemented as an independent `n8n` workflow for modularity, reliability, and easier debugging.

### 1. `generate-musthave-typeform-json`

- **Input:** Raw `must_haves` list (from a recruiter or job post form)
- **Output:** Valid Typeform JSON with:
  - All must-have filter questions
  - Welcome screen
  - Thank-you screen
- **Built with:**
  - GPT-3.5 to transform human input into structured Typeform-ready questions
  - Typeform API structure
- **Validates output:**
  - Automatically submits JSON to Typeform
  - On error: retries generation with error details in the prompt
  - On success: saves as `v1_output.json`
- **Constraints:**
  - Only uses `number`, `yes_no`, or `multiple_choice`
  - Every field is `required: true`
  - No salary logic yet (handled in the next step)

---

### 2. `add-salary-logic-branching`

- **Input:** Base Typeform JSON + salary budget (optional)
- **Function:** Adds salary expectation logic
  - If candidate enters a number above the defined cap → show follow-up: “Our budget is up to $X. Are you still interested?”
  - If below or no budget defined → follow-up question is skipped
- **Fallback:** Uses GPT-4 only if GPT-3.5 fails to structure valid logic
- **Checklist validation:**
  - Salary logic works correctly
  - Only shows salary cap if candidate expectations are higher

---

### 3. `append-nice-to-have-questions`

- **Input:** Existing JSON
- **Function:** Appends optional exploratory questions (e.g. tech stack, related industries, past tools)
- **Characteristics:**
  - Type: `multiple_choice` with `allow_multiple_selection: true`
  - Always includes `"Other"` as an option
  - Questions are logically grouped and follow related must-haves
- **Value:** Enriches candidate profile and adds commitment friction (to reduce low-effort applications)

---

### 4. `validate-and-deploy-final-form`

- **Input:** Full Typeform JSON (with must-haves, salary logic, and optional questions)
- **Validation Rules:**
  - Salary poker logic behaves correctly
  - Contact method matches job language:
    - 🇷🇺 Russian: ask for Telegram, skip LinkedIn
    - 🇺🇸 English: ask for phone + LinkedIn, skip Telegram
  - Email field is always present
- **Output:**
  - Deployed Typeform
  - Final `form_url`
  - Stored as `final_valid_form.json`

---

## 🛠 Local Development

- Each `.n8n.json` file can be run/tested independently inside your n8n environment
- Input examples stored in `/input_examples/`:
  - Realistic recruiter-written must-haves in multiple languages
  - Optional: expected output question lists for comparison
- Prompts stored in `/prompts/`
- Intermediate/final JSONs stored in `/output_jsons/`

---

## 🔄 Workflow Chain Summary

```plaintext
generate-musthave-typeform-json
    ↓
add-salary-logic-branching (optional)
    ↓
append-nice-to-have-questions
    ↓
validate-and-deploy-final-form
🧪 Example Output Format
json
Copy
Edit
{
  "question_text": "Do you have experience with Exchange Server?",
  "type": "yes_no",
  "required": true,
  "ref": "exchange_server_exp"
}