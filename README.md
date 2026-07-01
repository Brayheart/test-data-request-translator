# Test Data Request Translator

Single-page prototype for an Applied AI Analyst take-home.

The app turns messy consultant notes into a starter test dataset plus a structured request, in a short guided flow:

1. A single AI call interprets the free text and drafts a structured request — products, transaction types, expected behavior, recommended coverage, assumptions, and open questions.
2. Deterministic rules flag completeness gaps.
3. The consultant reviews, corrects, and fills in what they know.
4. A deterministic generator produces a small starter dataset (accounts + transactions) the consultant can test with immediately — no engineering ticket, no waiting.
5. Both the dataset (CSV) and the request (Markdown, plus JSON for downstream tools) are downloadable.

## What this builds

This prototype is intentionally scoped to one scenario: Example Credit Union launching checking and savings products with common transaction types and exception scenarios such as ACH, debit card, overdraft, dormant accounts, and rejected or closed-account cases.

After approval, the app can generate a small set of customers, accounts, and transactions that reflects the approved products, transaction types, and exception scenarios. The generator is deterministic, so the same approved request produces the same starter dataset.

## What it leaves out

- No full synthetic data engine. The core problem is request translation and coverage planning, not production-grade data generation.
- The starter dataset is intentionally small and illustrative. It is meant to close the loop for a consultant demo, not replace a production-grade banking data generator.
- No auth or persistence. The prototype demonstrates the workflow without storing client data.
- No real core-banking integration. The exported dataset and request stand in for loading into a real test environment.
- No multi-client configuration model. The narrow slice keeps the evaluation focused on AI intake, deterministic validation, and human review.

## Assumptions

- Consultants may start from partial notes, so the app should draft a request and preserve unresolved questions instead of pretending every detail is known.
- Checking, savings, ACH, debit card activity, overdraft, dormant accounts, and rejected/closed-account cases are a meaningful narrow slice of the larger banking-data problem.
- The starter dataset should be deterministic and representative, not production-grade synthetic banking data.
- Open questions should travel with the request unless the consultant can answer them by editing the structured fields before export.

## Local setup

```bash
npm install
cp .env.example .env.local
```

Add your OpenAI API key to `.env.local`. The default model is `gpt-5.5` with medium reasoning effort; change `OPENAI_MODEL` only if that model is not enabled for your API account.

```bash
npm run dev
```

Open `http://localhost:3000`.

## Testing

```bash
npm test
```

The tests cover the important cases:

- Messy input with overdraft and dormant accounts should create review flags.
- ACH "both directions" and closed-account behavior should not create false positives.
- Thin happy-path input should be flagged as incomplete.
- Markdown export should produce a readable request with friendly labels and requested coverage.
- Starter dataset generation should be deterministic and should represent selected products, transaction types, and exception scenarios.

## Positioning

The prototype is not trying to replace a consultant or engineer. It uses AI to draft a first-pass request from messy notes, labels assumptions, uses deterministic rules to catch gaps, and can produce a small reproducible starter dataset after consultant approval.
