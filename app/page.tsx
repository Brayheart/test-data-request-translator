"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildJsonExport, buildMarkdownExport } from "@/lib/export";
import { datasetToCsv, datasetToJson, generateStarterDataset } from "@/lib/generate";
import type { StarterDataset } from "@/lib/generate";
import { validateRequest } from "@/lib/rules";
import type {
  EdgeCase,
  ExtractedRequest,
  ProductType,
  TransactionRail,
  ValidationFlag
} from "@/lib/types";

const sampleInput =
  "Client is launching checking and savings, needs ACH deposits, debit card purchases, overdraft, and we should check dormant accounts too.";

const sampleInputs = [
  { name: "Overdraft launch", text: sampleInput },
  {
    name: "Closed account",
    text: "Checking only for now. Members need ACH both directions, debit card purchases, and we want to test what happens when a transaction hits a closed account."
  },
  {
    name: "Thin request",
    text: "We're setting up savings accounts for this credit union."
  }
];

const productOptions: Array<{ value: ProductType; label: string }> = [
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "money_market", label: "Money market" },
  { value: "loan", label: "Loan" }
];
const railOptions: Array<{ value: TransactionRail; label: string }> = [
  { value: "ach", label: "ACH transfer" },
  { value: "debit_card", label: "Debit card purchase" },
  { value: "internal_transfer", label: "Internal transfer" },
  { value: "wire", label: "Wire" },
  { value: "check", label: "Check" },
  { value: "cash", label: "Cash" }
];
const edgeOptions: Array<{ value: EdgeCase; label: string }> = [
  { value: "overdraft", label: "Overdraft" },
  { value: "dormant_account", label: "Dormant account" },
  { value: "closed_account", label: "Closed account" },
  { value: "rejected_transaction", label: "Rejected transaction" },
  { value: "insufficient_funds", label: "Insufficient funds" },
  { value: "fee_assessment", label: "Fee assessment" }
];

const severityLabel = {
  critical: "Important",
  warning: "Confirm",
  suggestion: "Optional"
} as const;

const productLabelByValue: Record<string, string> = {
  ...Object.fromEntries(productOptions.map((item) => [item.value, item.label])),
  unknown: "Needs confirmation"
};
const railLabelByValue: Record<string, string> = {
  ...Object.fromEntries(railOptions.map((item) => [item.value, item.label])),
  unknown: "Needs confirmation"
};
const edgeLabelByValue: Record<string, string> = {
  ...Object.fromEntries(edgeOptions.map((item) => [item.value, item.label])),
  unknown: "Needs confirmation"
};

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const scenarioLabel: Record<string, string> = {
  happy_path: "Happy path",
  overdraft: "Overdraft",
  dormant_account: "Dormant account",
  closed_account: "Closed account",
  rejected_transaction: "Rejected transaction",
  insufficient_funds: "Insufficient funds",
  fee_assessment: "Fee assessment",
  unknown: "Other"
};

const steps = ["Describe", "Review & confirm", "Deliverables"];
const loadingMessages = ["Reading the notes…", "Drafting the request…", "Checking for gaps…"];

function toggleValue<T extends string>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function displayList<T extends string>(values: T[], labels: Record<string, string>) {
  return values.length ? values.map((value) => labels[value] ?? value).join(", ") : "Not specified";
}

function displayAchDirection(value: ExtractedRequest["ach_direction"]) {
  const labels = {
    not_applicable: "Not applicable",
    unspecified: "Needs confirmation",
    incoming: "Incoming credits only",
    outgoing: "Outgoing debits only",
    both: "Both incoming and outgoing"
  };
  return labels[value];
}

function openItemsForPreview(request: ExtractedRequest, flags: ValidationFlag[]) {
  const items = [
    ...flags.map((flag) => `${flag.title}: ${flag.resolution_hint}`),
    ...request.consultant_questions
  ]
    .map((item) => item.trim())
    .filter(Boolean);
  return Array.from(new Set(items));
}

function download(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Textarea that grows to fit its content so nothing is clipped. */
function AutoTextarea({
  value,
  onChange,
  placeholder
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = () => {
    const el = ref.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  };
  useEffect(resize, [value]);
  return (
    <textarea
      ref={ref}
      className="autoArea"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      onInput={resize}
    />
  );
}

export default function Home() {
  const [input, setInput] = useState(sampleInput);
  const [request, setRequest] = useState<ExtractedRequest | null>(null);
  const [dataset, setDataset] = useState<StarterDataset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  const [msgIndex, setMsgIndex] = useState(0);
  const [copiedRequest, setCopiedRequest] = useState(false);

  const flags = useMemo(() => (request ? validateRequest(request) : []), [request]);
  const openItems = request ? openItemsForPreview(request, flags) : [];

  useEffect(() => {
    if (!loading) return;
    setMsgIndex(0);
    const id = setInterval(() => {
      setMsgIndex((current) => Math.min(current + 1, loadingMessages.length - 1));
    }, 4000);
    return () => clearInterval(id);
  }, [loading]);

  async function runExtraction() {
    setLoading(true);
    setError("");
    setDataset(null);
    setCopiedRequest(false);

    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Extraction failed.");
      }
      setRequest(payload.request);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed.");
    } finally {
      setLoading(false);
    }
  }

  function update<K extends keyof ExtractedRequest>(field: K, value: ExtractedRequest[K]) {
    if (!request) return;
    setRequest({ ...request, [field]: value });
    setDataset(null);
    setCopiedRequest(false);
  }

  function goToDeliverables() {
    if (!request) return;
    setDataset(generateStarterDataset(request));
    setCopiedRequest(false);
    setStep(3);
  }

  async function copyRequestMarkdown() {
    if (!request) return;
    const markdown = buildMarkdownExport(request, flags);

    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard API unavailable.");
      }
      await navigator.clipboard.writeText(markdown);
      setCopiedRequest(true);
      window.setTimeout(() => setCopiedRequest(false), 1800);
    } catch {
      download("test-data-request.md", markdown, "text/markdown");
    }
  }

  // Some review items can be resolved with one click instead of manual editing.
  // Adding the scenario also fills a sensible default behavior so the click resolves
  // the item cleanly instead of surfacing a new "behavior missing" warning.
  function flagAction(flagId: string): { label: string; run: () => void } | null {
    if (!request) return null;
    if (
      (flagId === "rejected-scenario" || flagId === "edge-cases-empty") &&
      !request.edge_cases.includes("closed_account")
    ) {
      return {
        label: "Add a closed-account test",
        run: () => {
          setRequest({
            ...request,
            edge_cases: [...request.edge_cases, "closed_account"],
            rejected_or_closed_account_behavior:
              request.rejected_or_closed_account_behavior.trim() ||
              "Transactions against closed accounts should reject with no balance change."
          });
          setDataset(null);
        }
      };
    }
    return null;
  }

  function startOver() {
    setStep(1);
    setRequest(null);
    setDataset(null);
    setError("");
    setCopiedRequest(false);
  }

  function loadSample(text: string) {
    setInput(text);
    setRequest(null);
    setDataset(null);
    setError("");
    setStep(1);
    setCopiedRequest(false);
  }

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Applied AI Analyst prototype</p>
        <h1>Test Data Request Translator</h1>
        <p className="lede">
          Turn what you know about a client setup into a structured test-data request and a ready-to-use
          starter dataset — without waiting on an engineer.
        </p>
        <ol className="stepper">
          {steps.map((label, index) => {
            const number = index + 1;
            const state = step === number ? "current" : step > number ? "done" : "upcoming";
            return (
              <li key={label} className={`stepItem ${state}`}>
                <span className="stepDot">{step > number ? "✓" : number}</span>
                <span>{label}</span>
              </li>
            );
          })}
        </ol>
      </section>

      {step === 1 ? (
        <section className="panel wide stepPanel">
          <p className="step">Step 1 of 3</p>
          <h2>Describe the client setup</h2>
          <p className="muted stepIntro">
            Paste what you know — products, transaction types, and any edge cases you want covered. Plain
            language is fine; the tool sorts out the structure.
          </p>
          <div className="sampleStrip" aria-label="Sample scenarios">
            {sampleInputs.map((sample) => (
              <button className="sampleButton" key={sample.name} onClick={() => loadSample(sample.text)}>
                {sample.name}
              </button>
            ))}
          </div>
          <textarea
            className="intakeArea"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Paste what the consultant knows about the client setup..."
          />
          <button className="primary" onClick={runExtraction} disabled={loading || !input.trim()}>
            {loading ? loadingMessages[msgIndex] : "Draft request"}
          </button>
          {loading ? (
            <p className="loadingNote">
              <span className="spinner" aria-hidden="true" />
              This takes about 10–15 seconds while the model reads your notes.
            </p>
          ) : null}
          {error ? <p className="error">{error}</p> : null}
        </section>
      ) : null}

      {step === 2 && request ? (
        <section className="panel wide stepPanel">
          <p className="step">Step 2 of 3</p>
          <h2>Review &amp; confirm</h2>
          <p className="muted stepIntro">
            Below is what the tool extracted from your notes. Correct anything that&apos;s off and fill in what
            you already know — anything you leave open is captured with the request so nothing gets lost.
          </p>

          <h3 className="blockHeading">Extracted from your notes</h3>
          <div className="summaryGrid">
            <div className="summaryCard">
              <span>Client</span>
              <strong>{request.client_name}</strong>
            </div>
            <div className="summaryCard">
              <span>Products</span>
              <strong>{displayList(request.products, productLabelByValue)}</strong>
            </div>
            <div className="summaryCard">
              <span>Transactions</span>
              <strong>{displayList(request.transaction_rails, railLabelByValue)}</strong>
            </div>
            <div className="summaryCard">
              <span>ACH</span>
              <strong>{displayAchDirection(request.ach_direction)}</strong>
            </div>
            <div className="summaryCard wideCard">
              <span>Exception scenarios</span>
              <strong>{displayList(request.edge_cases, edgeLabelByValue)}</strong>
            </div>
          </div>

          <details className="editScope">
            <summary>Edit products, transactions, or scenarios</summary>
            <div className="formGrid">
              <label>
                Client
                <input
                  value={request.client_name}
                  onChange={(event) => update("client_name", event.target.value)}
                />
              </label>
              <label>
                ACH transfer direction
                <select
                  value={request.ach_direction}
                  onChange={(event) =>
                    update("ach_direction", event.target.value as ExtractedRequest["ach_direction"])
                  }
                >
                  <option value="not_applicable">Not applicable</option>
                  <option value="unspecified">Needs confirmation</option>
                  <option value="incoming">Incoming credits only</option>
                  <option value="outgoing">Outgoing debits only</option>
                  <option value="both">Both incoming and outgoing</option>
                </select>
              </label>
              <fieldset>
                <legend>Products to test</legend>
                {productOptions.map((product) => (
                  <label className="check" key={product.value}>
                    <input
                      type="checkbox"
                      checked={request.products.includes(product.value)}
                      onChange={() => update("products", toggleValue(request.products, product.value))}
                    />
                    {product.label}
                  </label>
                ))}
              </fieldset>
              <fieldset>
                <legend>Transaction types to test</legend>
                {railOptions.map((rail) => (
                  <label className="check" key={rail.value}>
                    <input
                      type="checkbox"
                      checked={request.transaction_rails.includes(rail.value)}
                      onChange={() =>
                        update("transaction_rails", toggleValue(request.transaction_rails, rail.value))
                      }
                    />
                    {rail.label}
                  </label>
                ))}
              </fieldset>
              <fieldset className="full">
                <legend>Exception scenarios to include</legend>
                <div className="chips">
                  {edgeOptions.map((edgeCase) => (
                    <label className="chip" key={edgeCase.value}>
                      <input
                        type="checkbox"
                        checked={request.edge_cases.includes(edgeCase.value)}
                        onChange={() => update("edge_cases", toggleValue(request.edge_cases, edgeCase.value))}
                      />
                      {edgeCase.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </details>

          <h3 className="blockHeading">
            Fill in what you know <span className="optional">optional</span>
          </h3>
          <div className="answerGrid">
            {request.edge_cases.includes("overdraft") ? (
              <label>
                Overdraft behavior
                <AutoTextarea
                  value={request.overdraft_fee_behavior}
                  onChange={(value) => update("overdraft_fee_behavior", value)}
                  placeholder="Example: Allow the account to go negative and post the overdraft fee once per item."
                />
              </label>
            ) : null}
            {request.edge_cases.includes("dormant_account") ? (
              <label>
                Dormant account behavior
                <AutoTextarea
                  value={request.dormant_account_expected_behavior}
                  onChange={(value) => update("dormant_account_expected_behavior", value)}
                  placeholder="Example: Reject debit attempts and return an account-status reason."
                />
              </label>
            ) : null}
            <label>
              Rejected or closed-account behavior
              <AutoTextarea
                value={request.rejected_or_closed_account_behavior}
                onChange={(value) => update("rejected_or_closed_account_behavior", value)}
                placeholder="Example: Transactions against closed accounts should reject with no balance change."
              />
            </label>
            <label>
              Volume or date range
              <AutoTextarea
                value={request.volume_notes}
                onChange={(value) => update("volume_notes", value)}
                placeholder="Example: 25 members, 40 checking accounts, transactions across the last 90 days."
              />
            </label>
          </div>

          {request.recommended_test_coverage.length > 0 ? (
            <details className="coverageToggle">
              <summary>Planned test coverage ({request.recommended_test_coverage.length} scenarios)</summary>
              <ul>
                {request.recommended_test_coverage.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </details>
          ) : null}

          {flags.length > 0 || request.consultant_questions.length > 0 ? (
            <div className="confirmBlock">
              {flags.length > 0 ? (
                <>
                  <h3 className="blockHeading">Worth reviewing</h3>
                  <p className="muted subNote">
                    None of this blocks you — it&apos;s captured with the request. Fix what you can now; leave
                    the rest as open items.
                  </p>
                  <div className="flags">
                  {flags.map((flag) => {
                    const action = flagAction(flag.id);
                    return (
                      <div className={`flag ${flag.severity}`} key={flag.id}>
                        <span className="flagTop">
                          <strong>{flag.title}</strong>
                          <b>{severityLabel[flag.severity]}</b>
                        </span>
                        <small>{flag.issue}</small>
                        <em>{flag.resolution_hint}</em>
                        {action ? (
                          <button className="flagAction" onClick={action.run}>
                            {action.label}
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                  </div>
                </>
              ) : null}
              {request.consultant_questions.length > 0 ? (
                <div className="openQuestions">
                  <h4>Open items to confirm</h4>
                  <p className="muted subNote">
                    You don&apos;t resolve these here — they travel with your request as open items for the
                    client or your team to confirm. If you already know an answer, add it in the matching field
                    above (for example, a closed-account question goes in &ldquo;Rejected or closed-account
                    behavior&rdquo;).
                  </p>
                  <ul>
                    {request.consultant_questions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="wizardNav">
            <button className="ghost" onClick={() => setStep(1)}>
              Back
            </button>
            <button className="primary" onClick={goToDeliverables}>
              Continue to deliverables
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 && request ? (
        <section className="panel wide stepPanel">
          <p className="step">Step 3 of 3</p>
          <h2>Your test-data request is ready</h2>
          <p className="muted stepIntro">
            You can start with the starter dataset below, and keep this request as the spec for what was
            generated and what still needs confirmation.
          </p>

          <div className="requestPreview">
            <div className="requestPreviewHeader">
              <div>
                <h3>Test-data request</h3>
                <p className="muted">
                  Compact preview of the request. Copy or download includes the full request document.
                </p>
              </div>
              <div className="requestActions">
                <button className="primary" onClick={copyRequestMarkdown}>
                  {copiedRequest ? "Copied" : "Copy request"}
                </button>
                <button
                  className="secondary"
                  onClick={() =>
                    download("test-data-request.md", buildMarkdownExport(request, flags), "text/markdown")
                  }
                >
                  Download request
                </button>
                <button
                  className="linkButton"
                  onClick={() =>
                    download("test-data-request.json", buildJsonExport(request, flags), "application/json")
                  }
                >
                  Advanced (JSON)
                </button>
              </div>
            </div>

            <div className="requestPreviewGrid">
              <div className="previewBlock">
                <h4>Client</h4>
                <p>{request.client_name || "Example Credit Union"}</p>
              </div>
              <div className="previewBlock">
                <h4>Products</h4>
                <p>{displayList(request.products, productLabelByValue)}</p>
              </div>
              <div className="previewBlock">
                <h4>Transactions</h4>
                <p>{displayList(request.transaction_rails, railLabelByValue)}</p>
                {request.transaction_rails.includes("ach") ? (
                  <p className="previewSubline">ACH: {displayAchDirection(request.ach_direction)}</p>
                ) : null}
              </div>
              <div className="previewBlock">
                <h4>Exception scenarios</h4>
                <p>{displayList(request.edge_cases, edgeLabelByValue)}</p>
              </div>
              <div className="previewBlock wideBlock">
                <h4>Requested test coverage</h4>
                <ul className="compactList">
                  {(request.recommended_test_coverage.length
                    ? request.recommended_test_coverage
                    : ["Create active accounts and happy-path transactions for the selected products."]
                  ).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="previewBlock wideBlock">
                <h4>Expected behavior</h4>
                {request.edge_cases.includes("overdraft") ||
                request.edge_cases.includes("dormant_account") ||
                request.edge_cases.includes("closed_account") ||
                request.edge_cases.includes("rejected_transaction") ||
                request.edge_cases.includes("insufficient_funds") ? (
                  <ul className="compactList">
                    {request.edge_cases.includes("overdraft") ? (
                      <li>
                        <strong>Overdraft:</strong>{" "}
                        {request.overdraft_fee_behavior || "Needs confirmation"}
                      </li>
                    ) : null}
                    {request.edge_cases.includes("dormant_account") ? (
                      <li>
                        <strong>Dormant accounts:</strong>{" "}
                        {request.dormant_account_expected_behavior || "Needs confirmation"}
                      </li>
                    ) : null}
                    {request.edge_cases.includes("closed_account") ||
                    request.edge_cases.includes("rejected_transaction") ||
                    request.edge_cases.includes("insufficient_funds") ? (
                      <li>
                        <strong>Rejected or closed accounts:</strong>{" "}
                        {request.rejected_or_closed_account_behavior || "Needs confirmation"}
                      </li>
                    ) : null}
                  </ul>
                ) : (
                  <p>No exception behavior requested yet.</p>
                )}
              </div>
              <div className="previewBlock wideBlock">
                <h4>Still open to confirm</h4>
                {openItems.length ? (
                  <ul className="compactList">
                    {openItems.slice(0, 5).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p>None</p>
                )}
              </div>
            </div>
          </div>

          <div className="starterDataset">
            <div className="starterDatasetHeader">
              <div>
                <h3>Starter dataset</h3>
                <p className="muted">Small representative CSV generated from this request.</p>
              </div>
              {dataset ? (
                <div className="datasetActions">
                  <button
                    className="primary"
                    onClick={() => download("starter-dataset.csv", datasetToCsv(dataset), "text/csv")}
                  >
                    Download data (CSV)
                  </button>
                  <button
                    className="secondary"
                    onClick={() =>
                      download("starter-dataset.json", datasetToJson(dataset), "application/json")
                    }
                  >
                    Download JSON
                  </button>
                  <button className="linkButton" onClick={() => setDataset(generateStarterDataset(request))}>
                    Regenerate
                  </button>
                </div>
              ) : null}
            </div>
            {dataset ? (
              <div className="datasetStats">
                <span>
                  <strong>{dataset.accounts.length}</strong> accounts
                </span>
                <span>
                  <strong>{dataset.transactions.length}</strong> transactions
                </span>
                <span>As of {dataset.as_of}</span>
              </div>
            ) : null}
          </div>

          {dataset ? (
            <>
              <h3 className="blockHeading">Dataset preview</h3>
              <p className="muted previewNote">
                Deterministic: the same request always produces the same dataset, so test runs stay comparable.
              </p>
              <div className="tableScroll">
                <table className="dataTable">
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Customer</th>
                      <th>Product</th>
                      <th>Status</th>
                      <th className="num">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataset.accounts.map((account) => {
                      const customer = dataset.customers.find(
                        (item) => item.customer_id === account.customer_id
                      );
                      return (
                        <tr key={account.account_id}>
                          <td>{account.account_id}</td>
                          <td>{customer?.name ?? account.customer_id}</td>
                          <td>{productLabelByValue[account.product] ?? account.product}</td>
                          <td>
                            <span className={`statusPill ${account.status}`}>{account.status}</span>
                          </td>
                          <td className="num">{currency.format(account.balance)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="tableScroll">
                <table className="dataTable">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Account</th>
                      <th>Type</th>
                      <th>Dir.</th>
                      <th className="num">Amount</th>
                      <th>Status</th>
                      <th>Scenario</th>
                      <th>Memo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataset.transactions.map((txn) => (
                      <tr
                        key={txn.transaction_id}
                        className={txn.status === "rejected" ? "rejectedRow" : undefined}
                      >
                        <td>{txn.date}</td>
                        <td>{txn.account_id}</td>
                        <td>{railLabelByValue[txn.rail] ?? txn.rail}</td>
                        <td>{txn.direction}</td>
                        <td className="num">{currency.format(txn.amount)}</td>
                        <td>
                          <span className={`statusPill ${txn.status}`}>{txn.status}</span>
                        </td>
                        <td>{scenarioLabel[txn.scenario] ?? txn.scenario}</td>
                        <td>{txn.memo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          <div className="wizardNav">
            <button className="ghost" onClick={() => setStep(2)}>
              Back to review
            </button>
            <button className="secondary" onClick={startOver}>
              Start a new request
            </button>
          </div>
        </section>
      ) : null}
    </main>
  );
}
