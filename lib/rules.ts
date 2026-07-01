import type { ExtractedRequest, ValidationFlag } from "./types";

const blank = (value: string) => value.trim().length === 0;

export function validateRequest(request: ExtractedRequest): ValidationFlag[] {
  const flags: ValidationFlag[] = [];

  if (request.products.length === 0 || request.products.includes("unknown")) {
    flags.push({
      id: "products-missing",
      field: "products",
      title: "Product scope needs confirmation",
      issue: "The request does not clearly identify the account products that need test data.",
      severity: "critical",
      resolution_hint: "Confirm whether this request covers checking, savings, or another product."
    });
  }

  if (request.transaction_rails.includes("ach") && request.ach_direction === "unspecified") {
    flags.push({
      id: "ach-direction",
      field: "ach_direction",
      title: "ACH direction is missing",
      issue: "ACH is mentioned, but the request does not specify incoming, outgoing, or both directions.",
      severity: "warning",
      resolution_hint: "Specify whether to test ACH credits, ACH debits, or both."
    });
  }

  if (request.edge_cases.includes("overdraft") && blank(request.overdraft_fee_behavior)) {
    flags.push({
      id: "overdraft-fee-behavior",
      field: "overdraft_fee_behavior",
      title: "Overdraft fee behavior is missing",
      issue: "Overdraft testing is requested, but the fee or posting behavior is not described.",
      severity: "warning",
      resolution_hint: "Add whether fees should post, be waived, be capped, or be excluded from this request."
    });
  }

  if (
    request.edge_cases.includes("dormant_account") &&
    blank(request.dormant_account_expected_behavior)
  ) {
    flags.push({
      id: "dormant-behavior",
      field: "dormant_account_expected_behavior",
      title: "Dormant account behavior is missing",
      issue: "Dormant accounts are mentioned, but the expected transaction behavior is not stated.",
      severity: "warning",
      resolution_hint: "State whether transactions should post, reject, trigger review, or require a status change."
    });
  }

  const mentionsRejectedScenario =
    request.edge_cases.includes("closed_account") ||
    request.edge_cases.includes("rejected_transaction") ||
    request.edge_cases.includes("insufficient_funds");

  if (mentionsRejectedScenario && blank(request.rejected_or_closed_account_behavior)) {
    flags.push({
      id: "rejected-behavior",
      field: "rejected_or_closed_account_behavior",
      title: "Rejected or closed-account behavior is missing",
      issue: "A rejected or closed-account scenario is mentioned, but the expected result is not stated.",
      severity: "warning",
      resolution_hint: "State whether the transaction should reject, post, trigger review, or return a specific error."
    });
  } else if (
    !mentionsRejectedScenario &&
    blank(request.rejected_or_closed_account_behavior) &&
    request.edge_cases.length > 0
  ) {
    flags.push({
      id: "rejected-scenario",
      field: "rejected_or_closed_account_behavior",
      title: "Rejected or closed-account scenario not covered",
      issue: "The request does not include a negative-path scenario for rejected transactions or closed accounts.",
      severity: "suggestion",
      resolution_hint: "Consider adding at least one rejected transaction or closed-account test case."
    });
  }

  if (request.edge_cases.length === 0) {
    flags.push({
      id: "edge-cases-empty",
      field: "edge_cases",
      title: "No edge cases identified",
      issue: "The request only covers happy-path data, which can miss misleading test outcomes.",
      severity: "suggestion",
      resolution_hint: "Ask whether overdraft, insufficient funds, dormant, rejected, or closed-account cases matter."
    });
  }

  if (blank(request.volume_notes)) {
    flags.push({
      id: "volume-missing",
      field: "volume_notes",
      title: "Volume or date range not specified",
      issue: "The request does not say how many customers, accounts, or transactions are needed.",
      severity: "suggestion",
      resolution_hint: "Add rough counts or a date range, or use the small representative default."
    });
  }

  return flags;
}
