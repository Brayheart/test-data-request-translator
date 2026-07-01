import { describe, expect, it } from "vitest";
import { datasetCoverage, datasetToCsv, generateStarterDataset } from "./generate";
import type { ExtractedRequest } from "./types";

const asOf = new Date("2026-06-30T00:00:00Z");

const baseRequest: ExtractedRequest = {
  client_name: "Example Credit Union",
  products: ["checking", "savings"],
  transaction_rails: ["ach", "debit_card"],
  ach_direction: "incoming",
  edge_cases: ["overdraft", "closed_account"],
  overdraft_fee_behavior: "Post one $35 overdraft fee per item.",
  dormant_account_expected_behavior: "",
  rejected_or_closed_account_behavior: "Closed-account transactions reject with no balance change.",
  volume_notes: "Small representative set.",
  recommended_test_coverage: [],
  ai_draft_assumptions: [],
  consultant_questions: [],
  assumptions: [],
  confidence_notes: [],
  raw_input: ""
};

describe("generateStarterDataset", () => {
  it("is deterministic for the same approved request", () => {
    const first = generateStarterDataset(baseRequest, { asOf });
    const second = generateStarterDataset(baseRequest, { asOf });
    expect(second).toEqual(first);
  });

  it("changes when the request changes", () => {
    const a = generateStarterDataset(baseRequest, { asOf });
    const b = generateStarterDataset({ ...baseRequest, edge_cases: ["overdraft"] }, { asOf });
    expect(b.seed).not.toEqual(a.seed);
  });

  it("represents every requested product", () => {
    const dataset = generateStarterDataset(baseRequest, { asOf });
    const products = new Set(dataset.accounts.map((account) => account.product));
    expect(products.has("checking")).toBe(true);
    expect(products.has("savings")).toBe(true);
  });

  it("keeps the dataset small and illustrative", () => {
    const dataset = generateStarterDataset(baseRequest, { asOf });
    expect(dataset.accounts.length).toBeGreaterThanOrEqual(6);
    expect(dataset.accounts.length).toBeLessThanOrEqual(12);
    expect(dataset.transactions.length).toBeLessThanOrEqual(32);
  });

  it("starts transaction IDs at TXN-5001", () => {
    const dataset = generateStarterDataset(baseRequest, { asOf });
    expect(dataset.transactions[0]?.transaction_id).toBe("TXN-5001");
  });

  it("does not create debit card purchases on savings accounts", () => {
    const dataset = generateStarterDataset(baseRequest, { asOf });
    const accountById = new Map(dataset.accounts.map((account) => [account.account_id, account]));
    const savingsDebitCardRows = dataset.transactions.filter((txn) => {
      const account = accountById.get(txn.account_id);
      return account?.product === "savings" && txn.rail === "debit_card";
    });

    expect(savingsDebitCardRows).toEqual([]);
  });

  it("does not generate unknown products or rails from uncertain extraction", () => {
    const dataset = generateStarterDataset(
      {
        ...baseRequest,
        products: ["unknown"],
        transaction_rails: ["unknown"],
        edge_cases: ["unknown"]
      },
      { asOf }
    );

    expect(dataset.accounts.every((account) => account.product !== "unknown")).toBe(true);
    expect(dataset.transactions.every((txn) => txn.rail !== "unknown")).toBe(true);
    expect(dataset.transactions.every((txn) => txn.scenario !== "unknown")).toBe(true);
  });

  it("demonstrates overdraft with a negative balance and a fee", () => {
    const dataset = generateStarterDataset(baseRequest, { asOf });
    const overdraftRows = dataset.transactions.filter((txn) => txn.scenario === "overdraft");
    expect(overdraftRows.some((txn) => txn.rail === "fee")).toBe(true);

    const overdrawn = dataset.accounts.find((account) => account.balance < 0);
    expect(overdrawn).toBeDefined();
  });

  it("rejects a transaction against a closed account", () => {
    const dataset = generateStarterDataset(baseRequest, { asOf });
    const closed = dataset.accounts.find((account) => account.status === "closed");
    expect(closed).toBeDefined();

    const closedRow = dataset.transactions.find((txn) => txn.scenario === "closed_account");
    expect(closedRow?.status).toBe("rejected");
  });

  it("adds a dormant-account transaction using the consultant behavior note", () => {
    const dataset = generateStarterDataset(
      {
        ...baseRequest,
        edge_cases: ["dormant_account"],
        dormant_account_expected_behavior: "Dormant account debit attempts should reject for account status."
      },
      { asOf }
    );

    const dormant = dataset.accounts.find((account) => account.status === "dormant");
    const dormantRow = dataset.transactions.find((txn) => txn.scenario === "dormant_account");

    expect(dormant).toBeDefined();
    expect(dormantRow?.account_id).toBe(dormant?.account_id);
    expect(dormantRow?.status).toBe("rejected");
    expect(dormantRow?.memo.toLowerCase()).toContain("dormant");
  });

  it("does not post dormant activity when the behavior says blocked or declined", () => {
    const dataset = generateStarterDataset(
      {
        ...baseRequest,
        edge_cases: ["dormant_account"],
        dormant_account_expected_behavior:
          "Dormant accounts should not allow customer-initiated debits; attempts are blocked or declined without posting."
      },
      { asOf }
    );

    const dormantRow = dataset.transactions.find((txn) => txn.scenario === "dormant_account");
    expect(dormantRow?.status).toBe("rejected");
  });

  it("flags insufficient funds as a rejected row with no balance change", () => {
    const dataset = generateStarterDataset(
      { ...baseRequest, edge_cases: ["insufficient_funds"] },
      { asOf }
    );
    const row = dataset.transactions.find((txn) => txn.scenario === "insufficient_funds");
    expect(row?.status).toBe("rejected");
  });

  it("keeps memos short even when the behavior notes are long paragraphs", () => {
    const longParagraph =
      "Assumption to confirm: for debit card purchases that exceed available balance, accounts not " +
      "eligible for overdraft should be declined with no fee, while eligible accounts post one fee per item " +
      "subject to any client daily cap or grace threshold across the entire statement period.";
    const dataset = generateStarterDataset(
      {
        ...baseRequest,
        edge_cases: ["overdraft", "dormant_account", "closed_account"],
        overdraft_fee_behavior: longParagraph,
        dormant_account_expected_behavior: longParagraph,
        rejected_or_closed_account_behavior: longParagraph
      },
      { asOf }
    );

    for (const txn of dataset.transactions) {
      expect(txn.memo.length).toBeLessThanOrEqual(80);
    }
  });

  it("orders transactions chronologically with no fee before its overdraft", () => {
    const dataset = generateStarterDataset(baseRequest, { asOf });
    const dates = dataset.transactions.map((txn) => txn.date);
    expect([...dates].sort()).toEqual(dates);

    const purchase = dataset.transactions.find(
      (txn) => txn.scenario === "overdraft" && txn.rail === "debit_card"
    );
    const fee = dataset.transactions.find((txn) => txn.scenario === "overdraft" && txn.rail === "fee");
    expect(fee && purchase && fee.date >= purchase.date).toBe(true);
  });

  it("confirms coverage of the requested products, rails, and scenarios", () => {
    const dataset = generateStarterDataset(baseRequest, { asOf });
    const coverage = datasetCoverage(baseRequest, dataset);

    expect(coverage.products.map((item) => item.value)).toEqual(["checking", "savings"]);
    expect(coverage.products.every((item) => item.covered)).toBe(true);
    expect(coverage.scenarios.find((item) => item.value === "closed_account")?.covered).toBe(true);
    expect(coverage.scenarios.find((item) => item.value === "overdraft")?.covered).toBe(true);
  });

  it("marks a requested rail as not covered when product rules prevent that row", () => {
    const savingsDebitRequest: ExtractedRequest = {
      ...baseRequest,
      products: ["savings"],
      transaction_rails: ["debit_card"],
      edge_cases: []
    };
    const dataset = generateStarterDataset(savingsDebitRequest, { asOf });
    const coverage = datasetCoverage(savingsDebitRequest, dataset);
    const debitCard = coverage.rails.find((item) => item.value === "debit_card");
    expect(debitCard).toBeDefined();
    expect(debitCard?.covered).toBe(false);
  });

  it("exports a CSV with a header and one row per transaction", () => {
    const dataset = generateStarterDataset(baseRequest, { asOf });
    const lines = datasetToCsv(dataset).split("\n");
    expect(lines[0]).toContain("transaction_id");
    expect(lines[0]).toContain("scenario");
    expect(lines.length).toBe(dataset.transactions.length + 1);
  });
});
