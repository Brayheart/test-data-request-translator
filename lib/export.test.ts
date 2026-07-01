import { describe, expect, it } from "vitest";
import { buildMarkdownExport } from "./export";
import type { ExtractedRequest } from "./types";

const request: ExtractedRequest = {
  client_name: "Example Credit Union",
  products: ["checking", "savings"],
  transaction_rails: ["ach", "debit_card"],
  ach_direction: "incoming",
  edge_cases: ["overdraft", "dormant_account"],
  overdraft_fee_behavior: "Allow negative balance and post one overdraft fee per item.",
  dormant_account_expected_behavior: "Reject attempted debits and return dormant status reason.",
  rejected_or_closed_account_behavior: "Closed account transactions should reject with no balance change.",
  volume_notes: "25 members and 60 transactions across the last 90 days.",
  recommended_test_coverage: [
    "Create checking and savings accounts for active members.",
    "Create incoming ACH deposits and debit card purchases.",
    "Include overdraft and dormant-account exception scenarios."
  ],
  ai_draft_assumptions: ["Using a small representative dataset for implementation testing."],
  consultant_questions: ["Confirm whether overdraft fees should be waived for any members."],
  assumptions: ["Client name was not supplied; using Example Credit Union per prototype scope."],
  confidence_notes: [],
  raw_input: "Client is launching checking and savings with ACH deposits, debit purchases, overdraft, and dormant accounts."
};

describe("buildMarkdownExport", () => {
  it("creates a readable request with friendly labels and requested coverage", () => {
    const markdown = buildMarkdownExport(request, []);

    expect(markdown).toContain("begin testing without waiting on engineering");
    expect(markdown).toContain("- Checking");
    expect(markdown).toContain("- Debit card purchase");
    expect(markdown).toContain("Incoming credits only");
    expect(markdown).toContain("Create incoming ACH deposits and debit card purchases.");
    expect(markdown).toContain("Include overdraft and dormant-account exception scenarios.");
    expect(markdown).toContain("Confirm whether overdraft fees should be waived");
    expect(markdown).not.toContain("debit_card");
    expect(markdown).not.toContain("dormant_account");
  });

  it("renders thin or uncertain requests without leaking raw unknown enums", () => {
    const markdown = buildMarkdownExport(
      {
        ...request,
        products: ["savings"],
        transaction_rails: ["unknown"],
        ach_direction: "not_applicable",
        edge_cases: [],
        overdraft_fee_behavior: "",
        dormant_account_expected_behavior: "",
        rejected_or_closed_account_behavior: "",
        recommended_test_coverage: ["Open several savings accounts with standard customer details."]
      },
      []
    );

    expect(markdown).toContain("- Needs confirmation");
    expect(markdown).toContain("- No exception behavior requested yet.");
    expect(markdown).not.toContain("unknown");
  });
});
