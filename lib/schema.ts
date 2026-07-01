export const requestJsonSchema = {
  type: "object",
  properties: {
    client_name: {
      type: "string",
      description: "Client or financial institution name if supplied; otherwise Example Credit Union."
    },
    products: {
      type: "array",
      description: "Account products explicitly mentioned or clearly implied.",
      items: {
        type: "string",
        enum: ["checking", "savings", "money_market", "loan", "unknown"]
      }
    },
    transaction_rails: {
      type: "array",
      description: "Payment or transaction rails that require test data.",
      items: {
        type: "string",
        enum: ["ach", "debit_card", "internal_transfer", "wire", "check", "cash", "unknown"]
      }
    },
    ach_direction: {
      type: "string",
      description:
        "ACH direction when ACH is mentioned: deposits = incoming, payments/withdrawals/debits = outgoing, both directions = both, ACH mentioned without a direction = unspecified, ACH not mentioned = not_applicable.",
      enum: ["incoming", "outgoing", "both", "unspecified", "not_applicable"]
    },
    edge_cases: {
      type: "array",
      description: "Exception or QA scenarios mentioned or clearly implied by the consultant.",
      items: {
        type: "string",
        enum: [
          "overdraft",
          "dormant_account",
          "closed_account",
          "rejected_transaction",
          "insufficient_funds",
          "fee_assessment",
          "unknown"
        ]
      }
    },
    overdraft_fee_behavior: {
      type: "string",
      description:
        "If overdraft is in scope: ONE short sentence proposing the expected behavior, framed as an assumption to confirm. Empty string otherwise. Do not invent fee amounts."
    },
    dormant_account_expected_behavior: {
      type: "string",
      description:
        "If dormant accounts are in scope: ONE short sentence proposing the expected behavior, framed as an assumption to confirm. Empty string otherwise."
    },
    rejected_or_closed_account_behavior: {
      type: "string",
      description:
        "If rejected transactions, insufficient funds, or closed accounts are in scope: ONE short sentence proposing the expected behavior. Empty string otherwise."
    },
    volume_notes: {
      type: "string",
      description:
        "ONE short sentence with concrete small counts, e.g. 'About 8 accounts and 20 transactions across 5 business days.'"
    },
    recommended_test_coverage: {
      type: "array",
      description:
        "3 to 6 concise, plain-language test scenarios a non-technical consultant can read at a glance. No more than 6 items.",
      items: { type: "string" }
    },
    assumptions: {
      type: "array",
      description: "Up to 4 short assumptions the consultant should confirm or correct. No more than 4 items.",
      items: { type: "string" }
    },
    consultant_questions: {
      type: "array",
      description:
        "The 3 to 4 most important short follow-up questions to confirm with the client or internal team before the data is relied on. No more than 4 items.",
      items: { type: "string" }
    }
  },
  required: [
    "client_name",
    "products",
    "transaction_rails",
    "ach_direction",
    "edge_cases",
    "overdraft_fee_behavior",
    "dormant_account_expected_behavior",
    "rejected_or_closed_account_behavior",
    "volume_notes",
    "recommended_test_coverage",
    "assumptions",
    "consultant_questions"
  ],
  additionalProperties: false
} as const;

export const defaultRequest = {
  client_name: "Example Credit Union",
  products: ["checking", "savings"],
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
} as const;
