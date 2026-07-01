import { describe, expect, it } from "vitest";
import { validateRequest } from "./rules";
import type { ExtractedRequest } from "./types";

const baseRequest: ExtractedRequest = {
  client_name: "Example Credit Union",
  products: ["checking"],
  transaction_rails: [],
  ach_direction: "not_applicable",
  edge_cases: [],
  overdraft_fee_behavior: "",
  dormant_account_expected_behavior: "",
  rejected_or_closed_account_behavior: "",
  volume_notes: "",
  recommended_test_coverage: [],
  ai_draft_assumptions: [],
  consultant_questions: [],
  assumptions: [],
  confidence_notes: [],
  raw_input: ""
};

describe("validateRequest", () => {
  it("flags missing details from the main messy sample", () => {
    const flags = validateRequest({
      ...baseRequest,
      products: ["checking", "savings"],
      transaction_rails: ["ach", "debit_card"],
      ach_direction: "incoming",
      edge_cases: ["overdraft", "dormant_account"]
    });

    expect(flags.map((flag) => flag.id)).toEqual([
      "overdraft-fee-behavior",
      "dormant-behavior",
      "rejected-scenario",
      "volume-missing"
    ]);
  });

  it("flags a closed-account scenario when expected behavior is missing", () => {
    const flags = validateRequest({
      ...baseRequest,
      transaction_rails: ["ach"],
      ach_direction: "both",
      edge_cases: ["closed_account"],
      volume_notes: "Small representative set."
    });

    expect(flags.map((flag) => flag.id)).toEqual(["rejected-behavior"]);
  });

  it("does not false-positive when ACH direction and closed account behavior are supplied", () => {
    const flags = validateRequest({
      ...baseRequest,
      transaction_rails: ["ach"],
      ach_direction: "both",
      edge_cases: ["closed_account"],
      rejected_or_closed_account_behavior: "Closed account transactions should reject.",
      volume_notes: "Small representative set."
    });

    expect(flags.map((flag) => flag.id)).toEqual([]);
  });

  it("treats insufficient funds as a rejected-transaction behavior question", () => {
    const flags = validateRequest({
      ...baseRequest,
      edge_cases: ["insufficient_funds"],
      volume_notes: "Small representative set."
    });

    expect(flags.map((flag) => flag.id)).toEqual(["rejected-behavior"]);
  });

  it("flags thin happy-path input", () => {
    const flags = validateRequest({
      ...baseRequest,
      products: ["savings"]
    });

    expect(flags.map((flag) => flag.id)).toEqual(["edge-cases-empty", "volume-missing"]);
  });
});
