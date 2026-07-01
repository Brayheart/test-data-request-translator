import type { ExtractedRequest, ValidationFlag } from "./types";

const productLabels: Record<string, string> = {
  checking: "Checking",
  savings: "Savings",
  money_market: "Money market",
  loan: "Loan",
  unknown: "Needs confirmation"
};

const railLabels: Record<string, string> = {
  ach: "ACH transfer",
  debit_card: "Debit card purchase",
  internal_transfer: "Internal transfer",
  wire: "Wire",
  check: "Check",
  cash: "Cash",
  unknown: "Needs confirmation"
};

const edgeLabels: Record<string, string> = {
  overdraft: "Overdraft",
  dormant_account: "Dormant account",
  closed_account: "Closed account",
  rejected_transaction: "Rejected transaction",
  insufficient_funds: "Insufficient funds",
  fee_assessment: "Fee assessment",
  unknown: "Needs confirmation"
};

const achLabels: Record<ExtractedRequest["ach_direction"], string> = {
  incoming: "Incoming credits only",
  outgoing: "Outgoing debits only",
  both: "Both incoming and outgoing",
  unspecified: "Needs confirmation",
  not_applicable: "Not applicable"
};

function list(values: string[], labels: Record<string, string>) {
  return values.length ? values.map((value) => `- ${labels[value] ?? value}`).join("\n") : "- Not specified";
}

function scenarioPlan(request: ExtractedRequest) {
  if (request.recommended_test_coverage.length > 0) {
    return request.recommended_test_coverage.map((scenario) => `- ${scenario}`).join("\n");
  }

  const scenarios = [
    "Create at least one active account for each selected product.",
    ...request.transaction_rails.map((rail) => `Create a happy-path ${railLabels[rail] ?? rail} transaction.`)
  ];

  if (request.transaction_rails.includes("ach")) {
    scenarios.push(`ACH direction: ${achLabels[request.ach_direction]}.`);
  }

  request.edge_cases.forEach((edgeCase) => {
    scenarios.push(`Include exception scenario: ${edgeLabels[edgeCase] ?? edgeCase}.`);
  });

  return scenarios.map((scenario) => `- ${scenario}`).join("\n");
}

function expectedBehaviorBlock(request: ExtractedRequest) {
  const hasRejectedScenario = request.edge_cases.some((edgeCase) =>
    ["closed_account", "rejected_transaction", "insufficient_funds"].includes(edgeCase)
  );
  const rows: string[] = [];

  if (request.edge_cases.includes("overdraft") || request.overdraft_fee_behavior.trim()) {
    rows.push(`- Overdraft: ${request.overdraft_fee_behavior || "Needs confirmation"}`);
  }

  if (request.edge_cases.includes("dormant_account") || request.dormant_account_expected_behavior.trim()) {
    rows.push(
      `- Dormant accounts: ${request.dormant_account_expected_behavior || "Needs confirmation"}`
    );
  }

  if (hasRejectedScenario || request.rejected_or_closed_account_behavior.trim()) {
    rows.push(
      `- Rejected or closed accounts: ${
        request.rejected_or_closed_account_behavior || "Needs confirmation"
      }`
    );
  }

  return rows.length ? rows.join("\n") : "- No exception behavior requested yet.";
}

export function buildMarkdownExport(request: ExtractedRequest, flags: ValidationFlag[]) {
  const reviewedItems = flags.length
    ? flags.map((flag) => `- ${flag.title}: ${flag.resolution_hint}`).join("\n")
    : "- None";

  const assumptions = Array.from(
    new Set(
      [...request.assumptions, ...request.ai_draft_assumptions]
        .map((assumption) => assumption.trim())
        .filter(Boolean)
    )
  );
  const assumptionsBlock = assumptions.length
    ? assumptions.map((assumption) => `- ${assumption}`).join("\n")
    : "- None";

  return `# Test Data Request

The spec of record for this client's test data. A starter dataset has already been generated from it, so the consultant can begin testing without waiting on engineering. This document captures the configuration, the assumptions behind it, and the open items to confirm — keep it with the data, or share it if a larger production dataset is needed.

## Client
${request.client_name || "Example Credit Union"}

## Products
${list(request.products, productLabels)}

## Transaction Types
${list(request.transaction_rails, railLabels)}

## ACH Direction
${achLabels[request.ach_direction]}

## Exception Scenarios
${list(request.edge_cases, edgeLabels)}

## Requested Test Coverage
${scenarioPlan(request)}

## Expected Behavior
${expectedBehaviorBlock(request)}

## Volume or Date Range
${request.volume_notes || "Not specified"}

## Assumptions
${assumptionsBlock}

## Still Open to Confirm
${request.consultant_questions.map((question) => `- ${question}`).join("\n") || "- None"}

## Reviewed Rules and Suggestions
${reviewedItems}

## Source Input
${request.raw_input}
`;
}

export function buildJsonExport(request: ExtractedRequest, flags: ValidationFlag[]) {
  return JSON.stringify(
    {
      request,
      review_flags: flags,
      generated_at: new Date().toISOString()
    },
    null,
    2
  );
}
