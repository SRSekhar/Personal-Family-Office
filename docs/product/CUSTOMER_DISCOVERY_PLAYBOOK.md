# PFO OS Customer Discovery Playbook

**Status:** Ready to use for discovery; customer demand remains unvalidated.  
**Parent plan:** [Revenue Validation Plan](REVENUE_VALIDATION_PLAN.md)  
**Goal:** Learn whether recurring household-finance consolidation and reporting is painful enough for users to adopt and pay for a solution.

## Guardrails

- Interview about the participant's workflow, not their private balances or investment choices.
- Do not ask participants to send statements, account numbers, credentials, tax identifiers, or actual financial reports during discovery.
- Record anonymized notes using participant IDs such as `P01`; do not put names, email addresses, employers, or account details in this repository.
- Do not make investment, tax, or legal recommendations. The pilot hypothesis is software setup and reporting only.
- Do not describe planned functionality as already implemented. The current product is an early-stage prototype, not a production financial application.
- Ask permission before recording a conversation or retaining any material beyond anonymized notes.

## Who to interview first

Start with **self-directed Indian households** that track multiple asset/liability types across spreadsheets, apps, and statements. Prioritize people who recently prepared a net-worth summary, annual review, retirement projection, or family-finance report.

The first experiment targets 8–10 completed problem interviews. Do not mix independent financial planners, accountants, and small family offices into the primary sample; record them as a separate segment for later comparison.

## 30-minute interview structure

### 1. Context (3 minutes)

Use a neutral introduction:

> I'm researching how people organize and review their household finances. I'm not selling an investment product, and I'm not looking for your actual account details. I'd like to understand the process you use today and what is difficult about it.

Ask whether anonymized notes are acceptable. Do not start with a product demo.

### 2. Reconstruct a real recent task (10 minutes)

Ask open questions and follow the participant's own examples:

1. Tell me about the last time you reviewed or consolidated your household finances.
2. What caused you to do it at that time?
3. Walk me through the steps you took, from gathering information to the final summary.
4. Which sources or tools did you use? Please describe them without sharing private documents or account details.
5. How long did the task take, including corrections and follow-up?
6. Which step was most frustrating, error-prone, or easy to postpone?
7. How often do you repeat this task, and what usually triggers the next review?

Prefer a concrete recent example over hypothetical questions such as “Would you use an app that…?”

### 3. Understand impact and existing alternatives (7 minutes)

8. What happens when the task is late, incomplete, or inconsistent?
9. How do you check whether totals, dates, and returns are correct?
10. What do you currently do to make the process easier?
11. Have you tried another app, spreadsheet, adviser, or paid service? What worked and what did not?
12. Have you spent money or substantial time solving this problem? If so, what did you pay for or build yourself?

Record observed behavior and actual past spending separately from opinions about a possible future product.

### 4. Explore trust and privacy (4 minutes)

13. Which information would you be uncomfortable uploading to a cloud service or AI tool?
14. Would local/offline storage, export, and deletion controls change which tools you would consider? Why?
15. What would you need to verify before trusting a generated financial summary?

Do not promise that a future product is secure, compliant, or production-ready. Capture requirements to validate, not guarantees to make.

### 5. Close and request a next step (6 minutes)

16. If you could improve one part of your current process, which would matter most?
17. Is there a recent task or anonymized workflow example you would be willing to walk through in a follow-up?
18. May I contact you for a prototype review? If yes, keep contact details outside this repository.

Only after the workflow and pain are understood, ask whether the participant would consider a **paid, narrowly scoped setup/reporting pilot**. If they are interested, explain the scope and limitations before discussing price. A positive reaction is not a paid commitment.

## Optional prototype walkthrough (only after understanding the participant's workflow)

Use this short demonstration only if the participant's real recent workflow matches the problem being investigated. Do not lead with the demo and do not use a participant's private data.

1. Start the local browser workspace with `pnpm dashboard:serve`.
2. Use synthetic records to show the local-first dashboard and JSON export.
3. Build the report CLI with `pnpm build`.
4. Convert the synthetic dashboard backup into a self-contained report, using a valuation date that describes the data:

```powershell
New-Item -ItemType Directory -Force reports
$backup = Join-Path $env:USERPROFILE "Downloads\pfo-dashboard-backup.json"
node apps/cli/dist/index.js create --format dashboard-backup --input $backup --as-of 2026-10-01T00:00:00.000Z --output reports/dashboard-report.html
```

5. Open the HTML report and ask the participant to compare it with the output they create today: what is useful, what is missing, and what would need to change before they would repeat the workflow?

State the limitations plainly: dashboard records are mapped to generic asset/liability types with categories preserved; the CLI does not infer investment/property subtypes, convert currencies, import bank/brokerage data, store historical snapshots, or upload data. Use only synthetic data during the demo. If a participant wants to try real records, let them operate locally on their own device; do not ask them to send records or backups.

## What the concierge pilot may test

Only offer a pilot after confirming the participant's problem and consent. Keep the initial scope to:

- Help the participant organize their own records using a clearly agreed workflow.
- Use reviewed data supplied and controlled by the participant; do not request credentials or brokerage access.
- Produce a repeatable net-worth/financial summary with valuation dates and calculation assumptions visible.
- Measure setup time, correction effort, and whether the participant wants the report repeated.
- Make data handling, retention, export, and deletion expectations explicit before receiving any sensitive data.

Do not promise automatic bank/brokerage integrations, hosted storage, AI recommendations, tax/legal advice, or investment advice. Do not use real participant data in public fixtures, screenshots, or repository issues.

## Anonymized interview record template

Copy this template for each interview. Store only non-identifying, minimum-necessary notes.

| Field | Record |
| --- | --- |
| Participant ID | P01, P02, … |
| Segment | Self-directed household / other (keep other segments separate) |
| Interview date | YYYY-MM-DD |
| Recent task described | Short anonymized summary |
| Current workflow/tools | Categories of tools; no account identifiers |
| Frequency | How often the task is repeated |
| Time/effort | Participant's estimate and what it includes |
| Main pain | Participant's words, anonymized |
| Impact of the pain | Observed consequence or example |
| Current workaround | What they actually do today |
| Existing spend | Actual spend, if voluntarily disclosed |
| Privacy/trust requirements | Requirements, not promises |
| Evidence strength | Strong / moderate / weak, with rationale |
| Prototype follow-up | Yes / no / not asked |
| Paid pilot offered | Yes / no, with reason |
| Paid commitment | None / explicit commitment / paid |
| Next action | One specific follow-up or none |

## Evidence rules

Classify evidence consistently:

- **Strong:** A recent concrete example, repeated frequency, meaningful time/error impact, and a workaround or actual spend.
- **Moderate:** A specific problem is described, but frequency, impact, or behavior is not yet clear.
- **Weak:** General enthusiasm, hypothetical interest, compliments, or agreement after a product pitch without a concrete example.

Do not count waitlist interest, compliments, or “I would pay” answers as paid-pilot commitments. Count a paid commitment only when scope, price, timing, and the participant's agreement are explicit.

## Decision thresholds

Use the thresholds already defined in the [Revenue Validation Plan](REVENUE_VALIDATION_PLAN.md); do not reinterpret them after seeing the results:

- At least 8 completed problem interviews.
- At least 5 interviewees independently describe a recurring, meaningful version of the problem.
- At least 3 agree to try a prototype.
- At least 2 accept a paid pilot or make a concrete paid-pilot commitment.
- The prototype produces a useful summary without unsustainable manual effort.

At the end of the 30-day experiment, record one decision: **continue**, **revise the segment/problem**, or **stop**. Include the evidence and remaining uncertainty. Do not build subscription or hosted infrastructure solely because interviews were positive.
