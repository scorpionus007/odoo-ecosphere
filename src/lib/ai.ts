import { readFile } from "fs/promises";
import path from "path";

/**
 * AI evidence verification via Gemini 2.5 Flash Lite.
 *
 * Advisory pre-screening ONLY — it never approves or rejects anything.
 * Managers see the verdict as a hint next to the Approve button.
 * Degrades gracefully: no GEMINI_API_KEY, network failure or parse failure
 * all return null and the feature simply doesn't render.
 */

export type AiVerdict = {
  verdict: "SUPPORTED" | "INCONSISTENT" | "UNCLEAR";
  confidence: number; // 0-100
  reason: string;
};

const MODEL = "gemini-2.5-flash-lite";
const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
};

export function aiEnabled() {
  return !!process.env.GEMINI_API_KEY;
}

export async function verifyEvidence({
  claim,
  context,
  fileUrl,
}: {
  claim: string; // what the employee says the proof shows
  context: string; // surrounding detail (description, category, standard clause…)
  fileUrl: string; // /uploads/... path from our upload API
}): Promise<AiVerdict | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const ext = path.extname(fileUrl).toLowerCase();
    const mimeType = MIME[ext];
    if (!mimeType) return null; // unsupported file type — skip silently

    const filePath = path.join(process.cwd(), "public", fileUrl.replace(/^\//, ""));
    const data = await readFile(filePath);
    if (data.length > 15 * 1024 * 1024) return null;

    const prompt = `You are an evidence verification assistant for a corporate ESG (Environmental, Social, Governance) platform. An employee submitted the attached file as proof for this claim:

CLAIM: ${claim}
CONTEXT: ${context}

Assess whether the file plausibly supports the claim.
- "SUPPORTED": the content is clearly consistent with the claim
- "INCONSISTENT": the content clearly does not match the claim (e.g. an unrelated selfie submitted as tree-planting proof)
- "UNCLEAR": cannot determine (blurry, generic, or insufficient information)
Be strict but fair. A generic photo of a person is not proof of an activity unless the activity is visible.

Respond ONLY with JSON: {"verdict": "SUPPORTED"|"INCONSISTENT"|"UNCLEAR", "confidence": <integer 0-100>, "reason": "<one short sentence>"}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType, data: data.toString("base64") } },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        }),
      }
    );
    clearTimeout(timeout);
    if (!res.ok) {
      console.error("AI verify: Gemini returned", res.status, await res.text().catch(() => ""));
      return null;
    }
    const json = await res.json();
    const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    const parsed = JSON.parse(text);
    if (!["SUPPORTED", "INCONSISTENT", "UNCLEAR"].includes(parsed.verdict)) return null;
    return {
      verdict: parsed.verdict,
      confidence: Math.max(0, Math.min(100, Math.round(Number(parsed.confidence) || 0))),
      reason: String(parsed.reason ?? "").slice(0, 300),
    };
  } catch (e) {
    console.error("AI verify failed (non-blocking):", e instanceof Error ? e.message : e);
    return null;
  }
}
