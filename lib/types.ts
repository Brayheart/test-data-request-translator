export type Severity = "critical" | "warning" | "suggestion";

export type ProductType = "checking" | "savings" | "money_market" | "loan" | "unknown";

export type TransactionRail =
  | "ach"
  | "debit_card"
  | "internal_transfer"
  | "wire"
  | "check"
  | "cash"
  | "unknown";

export type EdgeCase =
  | "overdraft"
  | "dormant_account"
  | "closed_account"
  | "rejected_transaction"
  | "insufficient_funds"
  | "fee_assessment"
  | "unknown";

export type ExtractedRequest = {
  client_name: string;
  products: ProductType[];
  transaction_rails: TransactionRail[];
  ach_direction: "incoming" | "outgoing" | "both" | "unspecified" | "not_applicable";
  edge_cases: EdgeCase[];
  overdraft_fee_behavior: string;
  dormant_account_expected_behavior: string;
  rejected_or_closed_account_behavior: string;
  volume_notes: string;
  recommended_test_coverage: string[];
  ai_draft_assumptions: string[];
  consultant_questions: string[];
  assumptions: string[];
  confidence_notes: string[];
  raw_input: string;
};

export type AiDraftPlan = {
  recommended_test_coverage: string[];
  suggested_overdraft_fee_behavior: string;
  suggested_dormant_account_expected_behavior: string;
  suggested_rejected_or_closed_account_behavior: string;
  suggested_volume_notes: string;
  ai_draft_assumptions: string[];
  consultant_questions: string[];
};

export type ValidationFlag = {
  id: string;
  field: keyof ExtractedRequest | "overall";
  title: string;
  issue: string;
  severity: Severity;
  resolution_hint: string;
};
