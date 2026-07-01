import { NextResponse } from "next/server";
import { defaultRequest, requestJsonSchema } from "@/lib/schema";
import type { ExtractedRequest } from "@/lib/types";

const SYSTEM_PROMPT = `You turn a consultant's messy notes into a concise, structured banking test-data request they can review and use to generate a starter dataset.

Scope this narrowly: a community bank or credit union standing up common products (checking, savings) with common transaction types and exception scenarios.

Rules:
- Extract only what the consultant said or clearly implied. Do not invent fee schedules, amounts, or policies.
- ACH direction: deposits = incoming; payments/withdrawals/debits = outgoing; both = both; ACH with no direction = unspecified; no ACH = not_applicable.
- For any expected-behavior field, propose ONE short sentence as an assumption to confirm, or leave it empty if the scenario is out of scope.
- Keep everything brief and readable for a NON-TECHNICAL consultant: at most 6 test-coverage items, at most 4 assumptions, at most 4 questions. No jargon dumps.
- Return structured data only.`;

function extractText(response: unknown): string {
  if (
    typeof response === "object" &&
    response !== null &&
    "output_text" in response &&
    typeof response.output_text === "string"
  ) {
    return response.output_text;
  }

  const output = (response as { output?: Array<{ content?: Array<{ text?: string }> }> }).output;
  const text = output?.flatMap((item) => item.content ?? []).find((content) => content.text)?.text;
  return text ?? "";
}

function parseModelPayload(payload: unknown): Partial<ExtractedRequest> {
  const text = extractText(payload).trim();
  if (!text) {
    throw new Error("No structured text returned.");
  }
  return JSON.parse(text) as Partial<ExtractedRequest>;
}

function normalizeRequest(value: Partial<ExtractedRequest>, rawInput: string): ExtractedRequest {
  return {
    ...defaultRequest,
    ...value,
    client_name: value.client_name?.trim() || "Example Credit Union",
    // These are consolidated into `assumptions`; keep them empty for a clean request.
    ai_draft_assumptions: [],
    confidence_notes: [],
    raw_input: rawInput
  } as ExtractedRequest;
}

export async function POST(request: Request) {
  let body: { input?: string };

  try {
    body = (await request.json()) as { input?: string };
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const rawInput = body.input?.trim();

  if (!rawInput) {
    return NextResponse.json({ error: "Input is required." }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured. Add it to .env.local or your deployment env." },
      { status: 500 }
    );
  }

  const requestBody = {
    model: process.env.OPENAI_MODEL || "gpt-5.5",
    reasoning: {
      effort: process.env.OPENAI_REASONING_EFFORT || "medium"
    },
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: rawInput }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "test_data_request",
        strict: true,
        schema: requestJsonSchema
      }
    }
  };

  try {
    let lastParseError = "OpenAI returned an unreadable structured response.";

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const detail = await response.text();
        return NextResponse.json({ error: "OpenAI request failed.", detail }, { status: response.status });
      }

      const payload = await response.json();
      try {
        const parsed = parseModelPayload(payload);
        return NextResponse.json({ request: normalizeRequest(parsed, rawInput) });
      } catch (err) {
        lastParseError = err instanceof Error ? err.message : lastParseError;
      }
    }

    return NextResponse.json(
      { error: "The model returned a response the app could not read. Please try again.", detail: lastParseError },
      { status: 502 }
    );
  } catch {
    return NextResponse.json(
      { error: "The model request failed before a structured response was returned." },
      { status: 502 }
    );
  }
}
