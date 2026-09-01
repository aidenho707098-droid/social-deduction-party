// Shared plumbing for every AI-generated content feature (Imposter
// categories, Crack the Code themes, Fact or Fake topics, Taboo
// categories, Fake Artist themes).
//
// The OpenAI call, the timeout, the error-code normalisation and the
// host-facing error copy all live here ONCE — each game's generator (in
// aiContent.js) just supplies a prompt and sanitises the JSON it gets
// back. Nothing here persists; callers stash results on room state.

import OpenAI from "openai";

// Cheapest model in OpenAI's current lineup ($0.05 / 1M input, $0.40 / 1M
// output as of this writing). Generating a short list is a trivial task —
// it doesn't need a bigger model, and this app can see real party usage,
// so per-call cost matters. If OpenAI's lineup shifts, change this line.
export const MODEL = "gpt-5-nano";

// Hard ceiling on how long a host waits on the loading spinner before we
// give up and let them retry / fall back to built-in content.
export const REQUEST_TIMEOUT_MS = 12_000;

// Lazily created so the server still boots (and every other game still
// works) when OPENAI_API_KEY isn't set — only AI-content calls fail.
let client = null;

function getClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    const err = new Error("OPENAI_API_KEY is not set");
    err.code = "no_api_key";
    throw err;
  }
  if (!client) client = new OpenAI({ apiKey: key });
  return client;
}

// True if the server can generate AI content at all — used to hide these
// options client-side when there's no key rather than letting the host hit
// a guaranteed error.
export function aiContentAvailable() {
  return Boolean(process.env.OPENAI_API_KEY);
}

// One JSON-mode chat completion. Returns the PARSED object, or throws an
// Error tagged with a small, stable `.code`:
//   "no_api_key" | "timeout" | "rate_limit" | "api_error" | "bad_response"
export async function callJSON({ system, user, timeoutMs = REQUEST_TIMEOUT_MS }) {
  let completion;
  try {
    completion = await getClient().chat.completions.create(
      {
        model: MODEL,
        reasoning_effort: "minimal", // fastest + cheapest; these tasks are easy
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      },
      { timeout: timeoutMs, maxRetries: 1 },
    );
  } catch (err) {
    if (err?.code === "no_api_key") throw err;
    const status = err?.status ?? err?.response?.status;
    if (
      err?.name === "APIConnectionTimeoutError" ||
      err?.name === "AbortError" ||
      /tim(ed)? ?out/i.test(err?.message ?? "")
    ) {
      const e = new Error("OpenAI request timed out");
      e.code = "timeout";
      throw e;
    }
    if (status === 429) {
      const e = new Error("OpenAI rate limit / quota hit");
      e.code = "rate_limit";
      throw e;
    }
    if (status === 401 || status === 403) {
      const e = new Error("OpenAI rejected the API key");
      e.code = "no_api_key";
      throw e;
    }
    const e = new Error(`OpenAI call failed: ${err?.message ?? "unknown error"}`);
    e.code = "api_error";
    throw e;
  }

  const content = completion?.choices?.[0]?.message?.content ?? "";
  try {
    return JSON.parse(content);
  } catch {
    const e = new Error("OpenAI returned non-JSON content");
    e.code = "bad_response";
    throw e;
  }
}

// Throw a "bad_response" error — for a generator whose sanitised output
// didn't clear its own quality bar.
export function badResponse(message) {
  const e = new Error(message);
  e.code = "bad_response";
  throw e;
}

// Collapse whitespace, cap length, and Title-Case-ish the host's typed
// name for display (leave casing on words that already have caps, e.g.
// "NBA Teams", "90s Movies").
export function normalizeName(raw, maxLen = 40) {
  const collapsed = String(raw ?? "").replace(/\s+/g, " ").trim();
  return collapsed
    .slice(0, maxLen)
    .split(" ")
    .map((w) => (/[A-Z0-9]/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

// Trim + collapse whitespace + strip surrounding quotes/dashes from one
// short string the model returned.
export function cleanPhrase(raw) {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/\s+/g, " ")
    .replace(/^["'`\-–—\s]+|["'`\s]+$/g, "")
    .trim();
}

// Sanitise a raw string[] into a clean, de-duplicated word list.
// Case-insensitive dedupe; drops empties, over-long phrases, and anything
// with markup/newline residue.
export function sanitizeWordList(rawList, { max = 20, maxWords = 4 } = {}) {
  if (!Array.isArray(rawList)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of rawList) {
    const word = cleanPhrase(entry);
    if (!word || word.length > 40) continue;
    if (word.split(" ").length > maxWords) continue;
    if (/[\n\r{}[\]<>]/.test(word)) continue;
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(word);
    if (out.length >= max) break;
  }
  return out;
}

// Map an aiShared/aiContent error `.code` to a short line the host sees on
// a game's setup screen. `fallback` names what to use instead, e.g.
// "a built-in category" or "the trivia bank".
export function hostFacingAiError(err, fallback = "built-in content") {
  switch (err?.code) {
    case "no_api_key":
      return `AI content isn't set up on the server right now — use ${fallback}.`;
    case "timeout":
      return `That took too long to generate. Try again, or use ${fallback}.`;
    case "rate_limit":
      return "The AI service is busy right now. Wait a moment and try again.";
    case "bad_response":
      return `Couldn't build a good set for that one. Try a simpler or more common name.`;
    case "bad_name":
      return "Give it a clearer name and try again.";
    default:
      return `Couldn't reach the AI service. Try again, or use ${fallback}.`;
  }
}
