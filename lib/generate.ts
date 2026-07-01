import type { EdgeCase, ExtractedRequest, ProductType, TransactionRail } from "./types";

/**
 * Deterministic starter-dataset generator.
 *
 * Given an approved test-data request, this produces a small, illustrative set of
 * customers, accounts, and transactions that reflect the requested products,
 * transaction types, and exception scenarios. It is intentionally NOT a production
 * synthetic-data engine — a fuller implementation would expand it. The point is
 * to let a consultant walk away with realistic, reviewable sample data instead
 * of a ticket.
 *
 * The output is deterministic: the same approved request always yields the same
 * dataset (seeded RNG), so test runs are reproducible and comparable.
 */

export type AccountStatus = "active" | "dormant" | "closed";
export type TxnStatus = "posted" | "rejected";
export type TxnDirection = "credit" | "debit";
export type TxnRail = TransactionRail | "fee";
export type Scenario = EdgeCase | "happy_path";

export type GeneratedCustomer = {
  customer_id: string;
  name: string;
};

export type GeneratedAccount = {
  account_id: string;
  customer_id: string;
  product: ProductType;
  status: AccountStatus;
  opened_date: string;
  balance: number;
};

export type GeneratedTransaction = {
  transaction_id: string;
  account_id: string;
  date: string;
  rail: TxnRail;
  direction: TxnDirection;
  amount: number;
  status: TxnStatus;
  scenario: Scenario;
  memo: string;
};

export type StarterDataset = {
  client_name: string;
  as_of: string;
  seed: number;
  customers: GeneratedCustomer[];
  accounts: GeneratedAccount[];
  transactions: GeneratedTransaction[];
};

const FIRST_NAMES = ["Jordan", "Avery", "Riley", "Morgan", "Casey", "Quinn", "Taylor", "Devon", "Harper", "Reese"];
const LAST_NAMES = ["Nguyen", "Patel", "Garcia", "Johnson", "Okafor", "Rivera", "Cohen", "Murphy", "Sato", "Larsen"];

const productOpeningBalance: Record<ProductType, [number, number]> = {
  checking: [800, 4200],
  savings: [1500, 12000],
  money_market: [5000, 40000],
  loan: [-30000, -5000],
  unknown: [500, 2500]
};

// --- deterministic randomness -------------------------------------------------

function hash32(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    h = Math.imul(h ^ input.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromRequest(request: ExtractedRequest): number {
  const basis = JSON.stringify({
    client_name: request.client_name,
    products: request.products,
    rails: request.transaction_rails,
    ach: request.ach_direction,
    edges: request.edge_cases,
    od: request.overdraft_fee_behavior,
    dm: request.dormant_account_expected_behavior,
    rj: request.rejected_or_closed_account_behavior,
    vol: request.volume_notes
  });
  return hash32(basis);
}

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

function railsForProduct(product: ProductType, requestedRails: TransactionRail[]): TransactionRail[] {
  const rails = requestedRails.length ? requestedRails : (["internal_transfer"] as TransactionRail[]);

  if (product === "savings") {
    const allowed = rails.filter((rail) => rail === "ach" || rail === "internal_transfer" || rail === "cash");
    return allowed.length ? allowed : ["internal_transfer"];
  }

  if (product === "money_market") {
    const allowed = rails.filter(
      (rail) => rail === "ach" || rail === "internal_transfer" || rail === "check" || rail === "wire"
    );
    return allowed.length ? allowed : ["internal_transfer"];
  }

  if (product === "loan") {
    const allowed = rails.filter((rail) => rail === "ach" || rail === "internal_transfer" || rail === "cash");
    return allowed.length ? allowed : ["ach"];
  }

  return rails;
}

// --- helpers ------------------------------------------------------------------

const railLabel: Record<TransactionRail, string> = {
  ach: "ACH",
  debit_card: "Debit card purchase",
  internal_transfer: "Internal transfer",
  wire: "Wire transfer",
  check: "Check",
  cash: "Cash",
  unknown: "Transaction"
};

type ScenarioContext = {
  /** The dormant account that needs demonstrative activity. */
  account: GeneratedAccount;
  /** Mints a transaction against the dormant account, tagged with the dormant scenario. */
  makeTransaction: (input: {
    rail: TxnRail;
    direction: TxnDirection;
    amount: number;
    status: TxnStatus;
    memo: string;
  }) => GeneratedTransaction;
};

function buildDormantAccountTransactions(context: ScenarioContext): GeneratedTransaction[] {
  return [
    context.makeTransaction({
      rail: context.account.product === "checking" ? "debit_card" : "internal_transfer",
      direction: "debit",
      amount: 42.5,
      status: "rejected",
      memo: "Declined — account dormant; reactivation required"
    })
  ];
}

// --- generation ---------------------------------------------------------------

export function generateStarterDataset(
  request: ExtractedRequest,
  options: { asOf?: Date } = {}
): StarterDataset {
  const seed = seedFromRequest(request);
  const rng = mulberry32(seed);
  const asOf = options.asOf ?? new Date();

  const randInt = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
  const pick = <T>(items: T[]): T => items[Math.floor(rng() * items.length)];
  const dateBefore = (maxDaysAgo: number, minDaysAgo = 1) => {
    const daysAgo = randInt(minDaysAgo, maxDaysAgo);
    const d = new Date(asOf);
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  };

  const knownProducts = request.products.filter((product) => product !== "unknown");
  const products = knownProducts.length ? knownProducts : (["checking"] as ProductType[]);
  const rails = request.transaction_rails.filter((rail) => rail !== "unknown");
  const edges = request.edge_cases.filter((edgeCase) => edgeCase !== "unknown");

  // Customers — sized to the small representative volume the request recommends.
  const customerCount = randInt(7, 9);
  const customers: GeneratedCustomer[] = [];
  for (let i = 0; i < customerCount; i += 1) {
    customers.push({
      customer_id: `CUST-${101 + i}`,
      name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`
    });
  }

  // Accounts — cycle products so every requested product is represented.
  const accounts: GeneratedAccount[] = [];
  for (let i = 0; i < customerCount; i += 1) {
    const product = products[i % products.length];
    const [lo, hi] = productOpeningBalance[product] ?? productOpeningBalance.unknown;
    accounts.push({
      account_id: `ACC-${1001 + i}`,
      customer_id: customers[i].customer_id,
      product,
      status: "active",
      opened_date: dateBefore(900, 120),
      balance: money(lo + rng() * (hi - lo))
    });
  }

  // Designate exception accounts without removing a product's only account.
  const hasClosed = edges.includes("closed_account");
  const hasDormant = edges.includes("dormant_account");
  let closedAccount: GeneratedAccount | undefined;
  let dormantAccount: GeneratedAccount | undefined;
  if (hasClosed) {
    closedAccount = accounts[accounts.length - 1];
    closedAccount.status = "closed";
  }
  if (hasDormant && accounts.length >= 2) {
    dormantAccount = accounts[accounts.length - 2];
    dormantAccount.status = "dormant";
  }

  const transactions: GeneratedTransaction[] = [];
  let txnCounter = 0;
  const nextTxn = (input: Omit<GeneratedTransaction, "transaction_id">): GeneratedTransaction => {
    txnCounter += 1;
    return { transaction_id: `TXN-${5000 + txnCounter}`, ...input };
  };

  const balances = new Map(accounts.map((a) => [a.account_id, a.balance]));
  const adjust = (account: GeneratedAccount, delta: number) => {
    const updated = money((balances.get(account.account_id) ?? account.balance) + delta);
    balances.set(account.account_id, updated);
    account.balance = updated;
  };

  function railTransaction(account: GeneratedAccount, rail: TransactionRail): GeneratedTransaction {
    let direction: TxnDirection = "credit";
    if (rail === "ach") {
      if (request.ach_direction === "outgoing") direction = "debit";
      else if (request.ach_direction === "both") direction = rng() < 0.5 ? "credit" : "debit";
      else direction = "credit";
    } else if (rail === "debit_card" || rail === "wire" || rail === "check") {
      direction = "debit";
    } else if (rail === "internal_transfer") {
      direction = rng() < 0.5 ? "credit" : "debit";
    } else if (rail === "cash") {
      direction = "credit";
    }

    const amount = money(15 + rng() * 480);
    adjust(account, direction === "credit" ? amount : -amount);
    const verb = direction === "credit" ? "deposit" : "payment";
    const memo = rail === "ach" ? `ACH ${verb}` : railLabel[rail] ?? "Transaction";
    return nextTxn({
      account_id: account.account_id,
      date: dateBefore(90),
      rail,
      direction,
      amount,
      status: "posted",
      scenario: "happy_path",
      memo
    });
  }

  const activeAccounts = accounts.filter((a) => a.status === "active");

  // Happy-path activity for each active account.
  for (const account of activeAccounts) {
    const count = randInt(1, 2);
    const accountRails = railsForProduct(account.product, rails);
    for (let i = 0; i < count; i += 1) {
      const rail: TransactionRail = pick(accountRails);
      transactions.push(railTransaction(account, rail));
    }
  }

  const primaryActive = activeAccounts[0];

  // Exception scenarios — each only appears when the consultant requested it.
  if (edges.includes("overdraft") && primaryActive) {
    const overdraftTarget =
      activeAccounts.find((a) => a.product === "checking") ?? primaryActive;
    // Bring the account near zero so a normal-sized debit card purchase overdraws it,
    // instead of forcing an unrealistically large purchase.
    const available = money(15 + rng() * 85);
    balances.set(overdraftTarget.account_id, available);
    overdraftTarget.balance = available;
    const purchase = money(available + randInt(35, 180));
    // Purchase and its fee share a date so the fee never appears before the overdraft.
    const overdraftDate = dateBefore(45);
    adjust(overdraftTarget, -purchase);
    transactions.push(
      nextTxn({
        account_id: overdraftTarget.account_id,
        date: overdraftDate,
        rail: "debit_card",
        direction: "debit",
        amount: purchase,
        status: "posted",
        scenario: "overdraft",
        memo: "Debit card purchase that overdraws the account"
      })
    );
    const fee = 35;
    adjust(overdraftTarget, -fee);
    transactions.push(
      nextTxn({
        account_id: overdraftTarget.account_id,
        date: overdraftDate,
        rail: "fee",
        direction: "debit",
        amount: fee,
        status: "posted",
        scenario: "overdraft",
        memo: "Overdraft fee assessed"
      })
    );
  }

  if (edges.includes("insufficient_funds") && primaryActive) {
    const balance = balances.get(primaryActive.account_id) ?? primaryActive.balance;
    transactions.push(
      nextTxn({
        account_id: primaryActive.account_id,
        date: dateBefore(30),
        rail: "ach",
        direction: "debit",
        amount: money(balance + randInt(100, 500)),
        status: "rejected",
        scenario: "insufficient_funds",
        memo: "Declined — insufficient funds (no balance change)"
      })
    );
  }

  if (edges.includes("rejected_transaction") && primaryActive) {
    transactions.push(
      nextTxn({
        account_id: primaryActive.account_id,
        date: dateBefore(30),
        rail: rails.includes("ach") ? "ach" : "debit_card",
        direction: "debit",
        amount: money(20 + rng() * 200),
        status: "rejected",
        scenario: "rejected_transaction",
        memo: "Declined — transaction rejected by core"
      })
    );
  }

  if (closedAccount) {
    transactions.push(
      nextTxn({
        account_id: closedAccount.account_id,
        date: dateBefore(20),
        rail: rails.includes("ach") ? "ach" : "debit_card",
        direction: "debit",
        amount: money(20 + rng() * 200),
        status: "rejected",
        scenario: "closed_account",
        memo: "Declined — account closed (no balance change)"
      })
    );
  }

  if (edges.includes("fee_assessment") && primaryActive) {
    const fee = 12;
    adjust(primaryActive, -fee);
    transactions.push(
      nextTxn({
        account_id: primaryActive.account_id,
        date: dateBefore(30),
        rail: "fee",
        direction: "debit",
        amount: fee,
        status: "posted",
        scenario: "fee_assessment",
        memo: "Monthly maintenance fee"
      })
    );
  }

  if (dormantAccount) {
    const dormant = dormantAccount;
    const context: ScenarioContext = {
      account: dormant,
      makeTransaction: (input) =>
        nextTxn({
          account_id: dormant.account_id,
          date: dateBefore(30),
          rail: input.rail,
          direction: input.direction,
          amount: input.amount,
          status: input.status,
          scenario: "dormant_account",
          memo: input.memo
        })
    };
    transactions.push(...buildDormantAccountTransactions(context));
  }

  // Present transactions like a ledger: oldest first, with IDs that follow the order.
  // Sort is stable, so same-day rows (e.g. an overdraft purchase and its fee) keep order.
  transactions.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  transactions.forEach((txn, index) => {
    txn.transaction_id = `TXN-${5001 + index}`;
  });

  return {
    client_name: request.client_name || "Example Credit Union",
    as_of: asOf.toISOString().slice(0, 10),
    seed,
    customers,
    accounts,
    transactions
  };
}

// --- exports ------------------------------------------------------------------

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function datasetToCsv(dataset: StarterDataset): string {
  const customerName = new Map(dataset.customers.map((c) => [c.customer_id, c.name]));
  const accountById = new Map(dataset.accounts.map((a) => [a.account_id, a]));
  const header = [
    "transaction_id",
    "date",
    "customer",
    "account_id",
    "product",
    "account_status",
    "rail",
    "direction",
    "amount",
    "status",
    "scenario",
    "memo"
  ];
  const rows = dataset.transactions.map((txn) => {
    const account = accountById.get(txn.account_id);
    return [
      txn.transaction_id,
      txn.date,
      customerName.get(account?.customer_id ?? "") ?? "",
      txn.account_id,
      account?.product ?? "",
      account?.status ?? "",
      txn.rail,
      txn.direction,
      txn.amount.toFixed(2),
      txn.status,
      txn.scenario,
      txn.memo
    ];
  });
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

export function datasetToJson(dataset: StarterDataset): string {
  return JSON.stringify(dataset, null, 2);
}

export type CoverageItem = { value: string; covered: boolean };

export type DatasetCoverage = {
  products: CoverageItem[];
  rails: CoverageItem[];
  scenarios: CoverageItem[];
};

/**
 * Read-only confirmation that the generated dataset actually covers what the
 * request asked for. Pure over the dataset — it changes nothing, it just checks
 * each requested product / transaction type / exception scenario against the
 * rows that were produced.
 */
export function datasetCoverage(request: ExtractedRequest, dataset: StarterDataset): DatasetCoverage {
  const productSet = new Set<string>(dataset.accounts.map((account) => account.product));
  const railSet = new Set<string>(dataset.transactions.map((txn) => txn.rail));
  const scenarioSet = new Set<string>(dataset.transactions.map((txn) => txn.scenario));
  const dedupe = (values: string[]) => Array.from(new Set(values.filter((value) => value !== "unknown")));

  return {
    products: dedupe(request.products).map((value) => ({ value, covered: productSet.has(value) })),
    rails: dedupe(request.transaction_rails).map((value) => ({ value, covered: railSet.has(value) })),
    scenarios: dedupe(request.edge_cases).map((value) => ({ value, covered: scenarioSet.has(value) }))
  };
}
