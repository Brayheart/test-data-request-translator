# Submission Notes

## Short summary

I built a small internal prototype called Test Data Request Translator. It helps an implementation consultant turn messy client setup notes into a starter test dataset and a structured request — without waiting on an engineer.

The workflow is a short guided flow: a single AI call interprets the free-text intake and drafts a structured request, deterministic rules flag missing details, the consultant reviews and fills in what they know, and a deterministic generator produces a small starter dataset from the approved request. The dataset (CSV) and the request (Markdown, plus JSON for downstream tools) are both downloadable.

## Why this shape

The bottleneck described in the prompt is not just generating sample banking rows. The harder operational problem is translating what a consultant knows about a client configuration into a request that is clear enough to review, reuse, and expand without back-and-forth.

That is why the prototype separates responsibilities:

- AI handles ambiguous language, extracts structure from notes, and drafts recommended test coverage.
- Rules handle completeness checks that should be consistent every time.
- The consultant stays accountable by reviewing and approving the final request.
- The starter dataset is deterministic so the same approved request produces reproducible accounts and transactions.

## Assumptions I made

- A useful first slice is a credit union launching common deposit products, not every banking product or every possible data policy.
- The consultant may know only part of the client configuration, so the tool should preserve open questions instead of silently guessing.
- A small deterministic starter dataset is useful for review and early testing, but it should not be represented as production-grade synthetic banking data.
- If an unresolved question affects the data, the consultant should resolve it by editing the structured request fields before export.

## Demo script

1. Start with messy notes:

   `Client is launching checking and savings, needs ACH deposits, debit card purchases, overdraft, and we should check dormant accounts too.`

2. Draft the request.

3. Point out what the model extracted: products, transaction types, ACH direction, and exception scenarios.

4. Point out what the draft added: recommended coverage, expected behavior, assumptions, and questions to confirm.

5. Point out what the rules layer flags after the draft.

6. Edit the draft where the consultant disagrees or knows the exact client behavior.

7. Continue to the deliverables: generate the starter dataset and download it (CSV), plus the structured request (Markdown).

8. Point out that the dataset is small, illustrative, reproducible, and derived from the approved request.

## What I left out and why

I did not build a full synthetic data engine. A realistic banking data generator would need deeper product rules, status transitions, fee schedules, ledger behavior, and validation against the target system. For this prototype, the focus is letting the consultant self-serve: converting ambiguous context into a clear request and a small, reproducible starter dataset they can begin testing with immediately, rather than filing a ticket and waiting.

I did not add authentication or persistence. The prototype is meant to demonstrate the workflow, not store client information.

I did not try to support every banking product or every possible client. I scoped the demo to a credit union launching checking and savings so I could make the intake, rules, review, and export flow work clearly end to end.

I did not integrate with a real core banking system or ticketing workflow. The exported JSON and Markdown stand in for the request artifact that would travel with the generated starter data.

## If I had another day

I would add a guided follow-up question step for unresolved flags, keep a small history of approved requests, and work with implementation leads to tune the deterministic rule set against common Nymbus request issues.
