# 🧩 AI-Powered Candidate Journey Builder

This repository automates the **entire candidate journey** — from clicking "Apply" to completing a final interview step — using OpenAI and `n8n`.

---

## 🛤 Candidate Journey Stages

1. **Application Form**
   - Automatically generated from job post and requirements
   - Includes must-have filters, salary logic, and contextual follow-ups

2. **Hard Skill Quiz**
   - Generated or manually written assessments
   - Can be personalized per role or tech stack

3. **Video Answer Submission**
   - Pre-recorded questions + video answers (e.g., via Hireflix or in-house system)

Each stage is fully automated **from the candidate’s perspective**, while remaining manually controllable from your side for safety and iteration.


---

## ✅ Status

- ✅ Candidate Application Form → **in progress**
- ⏳ Hard Skill Quiz → planned
- ⏳ Video Questions → planned

---

## 🤖 Technology Stack

- `n8n` for automation pipelines
- OpenAI GPT-3.5 / GPT-4 for prompt-driven generation
- Typeform API for candidate-facing forms
- Git-based versioning for prompt iteration and fallback handling

---

## 💡 Design Principles

- Modular workflows for easy debugging & handoff
- Human-readable text logs (prompts + results)
- Fail-safe fallbacks for OpenAI and API errors
- Realistic flow: motivated candidates should be able to finish all steps without interruption

---

## 👥 Team & Roadmap

We're currently focused on perfecting the Application form generation step. All contributions, ideas, or testing feedback are welcome.

\n\nLicensed under the MIT License.
