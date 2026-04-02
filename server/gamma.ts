import type { GammaResult } from "@shared/schema";

const GAMMA_API_BASE = "https://api.gamma.app/v1.0";

/**
 * Strip HTML tags from content and limit to maxLength characters.
 */
function stripHtmlAndLimit(html: string, maxLength = 80000): string {
  // Remove script and style blocks
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");

  // Replace block-level tags with newlines
  text = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|h[1-6]|li|tr|td|th|section|article|header|footer|blockquote)[^>]*>/gi, "\n");

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");

  // Collapse multiple blank lines
  text = text.replace(/\n{3,}/g, "\n\n").trim();

  return text.slice(0, maxLength);
}

/**
 * Build the Gamma API payload for slide generation.
 */
function buildGammaPayload(subject: string, textContent: string, numCards: number) {
  return {
    subject,
    text: textContent,
    numCards,
    theme: "modern",
    language: "vi",
    audience: "professional",
    imageOptions: {
      enabled: true,
      source: "unsplash",
    },
  };
}

/**
 * Start a Gamma presentation generation.
 * @returns generationId (string)
 */
export async function createGammaPresentation(
  subject: string,
  htmlContent: string,
  numCards: number
): Promise<string> {
  const apiKey = process.env.GAMMA_API_KEY;
  const folderId = process.env.GAMMA_FOLDER_ID;

  if (!apiKey) {
    throw new Error("GAMMA_API_KEY chưa được cấu hình");
  }

  // Strip HTML and limit content
  const textContent = stripHtmlAndLimit(htmlContent, 80000);

  const payload: any = buildGammaPayload(subject, textContent, numCards);
  if (folderId) {
    payload.folderId = folderId;
  }

  const response = await fetch(`${GAMMA_API_BASE}/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gamma API error ${response.status}: ${errorText}`);
  }

  const data = await response.json() as any;
  const generationId = data.id || data.generationId;

  if (!generationId) {
    throw new Error("Gamma API không trả về generationId");
  }

  return String(generationId);
}

/**
 * Check the status of a Gamma generation.
 */
export async function checkGammaStatus(generationId: string): Promise<GammaResult> {
  const apiKey = process.env.GAMMA_API_KEY;

  if (!apiKey) {
    throw new Error("GAMMA_API_KEY chưa được cấu hình");
  }

  const response = await fetch(`${GAMMA_API_BASE}/generations/${generationId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gamma API error ${response.status}: ${errorText}`);
  }

  const data = await response.json() as any;

  // Map Gamma status to our GammaResult format
  const rawStatus: string = data.status || "pending";
  let status: GammaResult["status"] = "pending";

  if (rawStatus === "completed" || rawStatus === "done" || rawStatus === "success") {
    status = "completed";
  } else if (rawStatus === "failed" || rawStatus === "error") {
    status = "failed";
  } else if (rawStatus === "processing" || rawStatus === "running" || rawStatus === "in_progress") {
    status = "processing";
  }

  return {
    generationId,
    status,
    gammaUrl: data.gammaUrl || data.url || data.presentationUrl || undefined,
    pptxUrl: data.pptxUrl || data.downloadUrl || undefined,
  };
}
