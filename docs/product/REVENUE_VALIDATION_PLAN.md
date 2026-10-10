# PFO OS Revenue Validation Plan

**Status:** Hypotheses to validate; not a forecast or claim of customer demand.  
**Objective:** Find a credible path to recurring income before investing heavily in paid features.

## 1. Initial Product Hypothesis

PFO OS could help self-directed Indian households consolidate financial information across multiple asset classes, understand their net worth and investment returns, model long-term goals, and generate repeatable family-finance reports.

The initial differentiator to test is **privacy-conscious, explainable financial organization** rather than investment recommendations. The first version should make it easier to understand and report a family's financial position, not tell users what securities to buy or sell.

This hypothesis is not validated. Interviews and paid pilots must determine whether the problem is painful enough to pay for.

## 2. Candidate Customer Segments

### Primary hypothesis: Self-directed households

Households that track several of the following in separate apps or spreadsheets: mutual funds, direct equities, provident funds, NPS, deposits, property, loans, insurance, income, and expenses.

Likely pain points to test:
- Manual monthly or annual consolidation.
- Difficulty calculating money-weighted returns across cash flows.
- Inconsistent valuation dates and incomplete records.
- Time-consuming preparation of a family financial summary.
- Privacy concerns about uploading statements to a cloud service or AI assistant.

### Secondary hypotheses

- Independent financial planners who need consistent client reporting.
- Accountants or tax professionals who help households organize records.
- Small family offices that need recurring reporting and a searchable financial history.

Do not build for all segments at once. Start with one segment and test its willingness to pay.

## 3. Smallest Useful MVP

Build only after interviews confirm the workflow.

1. Manual entry and reviewed CSV import for assets, liabilities, and dated cash flows.
2. Net-worth snapshot and historical trend.
3. Deterministic CAGR and XIRR calculations with clear assumptions.
4. Goal/FIRE scenario inputs with transparent assumptions.
5. Exportable monthly or annual financial summary.
6. Local-first or self-hosted data storage, with explicit export and deletion.
7. An audit trail showing source data, valuation date, and calculation assumptions.

Defer bank integrations, automated document extraction, AI-generated recommendations, brokerage connections, and multi-user cloud hosting until the basic workflow has proven useful. Do not invent APIs or use real financial data in public fixtures.

## 4. Revenue Hypotheses

### Near-term: paid setup and reporting pilot

Offer a small number of paid pilot engagements to help a household organize its own data and produce a repeatable financial summary. This tests willingness to pay before building a full subscription product. The scope must be software setup and reporting, not unlicensed investment, tax, or legal advice.

### Recurring income: subscription

If the pilot demonstrates repeat use, test a subscription around:
- Secure local/self-hosted financial records.
- Monthly reporting and historical comparisons.
- Goal and retirement scenarios.
- Export, backup, and versioned snapshots.
- Optional AI explanations that use only approved, minimized data.

### Longer-term: Pro, hosting, and support

Possible offers include premium reports, managed backups, family collaboration, support, and hosted services. These are options to validate—not committed features.

## 5. 30-Day Validation Experiment

Use the operational [Customer Discovery Playbook](CUSTOMER_DISCOVERY_PLAYBOOK.md) for the interview script, anonymized record template, privacy guardrails, and evidence classification.

### Week 1 — Problem interviews

- Speak with 8–10 people in the primary segment.
- Ask how they currently track their finances, what the last reporting task took, which errors or gaps occur, and what they have already tried.
- Do not pitch features until the current workflow is understood.
- Record anonymized themes, not private account data.

### Week 2 — Concierge prototype

- Use synthetic data to demonstrate the report format.
- Ask interested users to provide only the minimum data they consent to share, through a private and appropriate channel.
- Produce one report manually using deterministic calculations.
- Measure setup time and identify which information users actually value.

### Week 3 — Paid pilot offer

- Offer a clearly scoped pilot to users who experienced the problem.
- Test more than one price point in conversations rather than assuming a price is correct.
- Be explicit about data handling, what the product does, and what it does not do.

### Week 4 — Decide

Continue building the subscription MVP only if evidence supports it. Otherwise, revise the target segment or problem statement.

## 6. Initial Evidence Thresholds

Treat these as decision rules for the experiment, not industry benchmarks:

- At least 8 completed problem interviews.
- At least 5 interviewees independently describe a recurring, meaningful version of the problem.
- At least 3 agree to try a prototype.
- At least 2 accept a paid pilot or make a concrete paid-pilot commitment.
- The prototype produces a useful summary without requiring an unsustainable amount of manual work.

If interest is positive but nobody will pay, do not interpret compliments or waitlist sign-ups as product-market fit.

## 7. Success Metrics After Launch

- Time from signup to first useful financial summary.
- Percentage of users completing a monthly review.
- Four-week and twelve-week retention.
- Trial-to-paid conversion.
- Monthly recurring revenue and churn.
- Support time per paying household.
- Import correction rate and calculation error rate.
- User trust, data export success, and deletion success.

## 8. Privacy, Legal, and Trust Guardrails

- Never commit real financial statements, account identifiers, balances, credentials, or personal reports to the public repository.
- Use synthetic fixtures and sample data.
- Do not send private financial data to an AI provider without explicit consent, data minimization, and an appropriate security design.
- Keep deterministic calculations separate from AI-generated explanations.
- Show data dates, assumptions, limitations, and calculation methods.
- Avoid buy/sell recommendations until applicable Indian regulatory and legal requirements have been reviewed by qualified counsel.
- Do not promise investment outcomes, guaranteed returns, or a legal/compliance status that has not been established.

## 9. Decisions Needed Before a Public Product Release

1. Public framework versus private application repository.
2. License strategy for reusable components.
3. Whether the initial product is local-first, self-hosted, or hosted.
4. Primary customer segment and first paid pilot scope.

## Recommendation

Validate the recurring reporting problem with real prospective users before building a large dashboard or AI recommendation engine. The first commercial milestone is **two paid pilots and evidence of repeat usage**, not a feature-complete platform.
