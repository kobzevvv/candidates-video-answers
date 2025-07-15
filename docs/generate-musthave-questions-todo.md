# ✅ TODO – Workflow: generate-musthave-questions

This workflow transforms raw human-written "must haves" into a structured list of Typeform questions (only must-have filters). It is the first step in the candidate self-evaluation form pipeline.

---

## 🎯 Objective

- Parse real-world recruiter inputs from `must_haves_raw`
- Generate structured question objects with:
  - `question_text`
  - `type` (`number`, `yes_no`, or `multiple_choice`)
  - `required: true`
  - `ref` (snake_case, max 40 chars)
  - `options` (only for multiple_choice)

---

## 🔍 Scope

- Use GPT-3.5-turbo for generation
- Output **only must-have filters**
- Avoid open-ended or exploratory questions
- Avoid salary logic — handled in later workflow

---

## 🛠 Prompt Design To-Dos

- [ ] Write `base_prompt.txt` with clear formatting rules:
  - Output format as JSON list of questions
  - Allow only limited types
  - Ensure `ref` follows naming rules
- [ ] Add instruction on how to handle:
  - salary ranges (convert to `number` field)
  - geographic or timezone constraints
  - soft constraints like "preferably", "ideally" → still include as required
- [ ] Add fallback message in case input is empty or unclear

---

## 🧪 Testing To-Dos

- [ ] Use all files in `input_examples/` as test set
- [ ] Add expected outputs for at least 3 examples
- [ ] Create a test harness to:
  - Feed each `must_haves_raw` into prompt
  - Compare output to `expected_output_questions` (when defined)
  - Log any parsing or formatting issues

---

## 🧱 Output Schema Example

```json
[
  {
    "question_text": "How many years of experience do you have with system administration?",
    "type": "number",
    "required": true,
    "ref": "sysadmin_experience"
  },
  {
    "question_text": "Do you have experience with VMware or Hyper-V?",
    "type": "yes_no",
    "required": true,
    "ref": "vmware_hyperv_exp"
  }
]
💡 Future Ideas
 Add light language detection to enforce localization (e.g., if ru then use Russian-language question text)

 Tag each generated question with a related topic (e.g., "experience", "location", "salary") for grouping

 Add a basic OpenAI validator step to verify JSON structure before passing to next workflow

📁 Files to Maintain
base_prompt.txt – main prompt sent to OpenAI

input_examples/*.json – raw must-have input data

test_output/*.json – structured output for QA