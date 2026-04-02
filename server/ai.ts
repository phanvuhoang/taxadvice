import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { Citation } from "@shared/schema";

// ---- Perplexity Client (OpenAI-compatible) ----

function getPerplexityClient(): OpenAI | null {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key, baseURL: "https://api.perplexity.ai" });
}

/**
 * Search the internet via Perplexity Sonar when the local database
 * doesn't contain enough information to answer a question.
 * Returns the Perplexity answer text + citations array.
 */
export async function searchWithPerplexity(question: string): Promise<{
  answer: string;
  citations: string[];
} | null> {
  const client = getPerplexityClient();
  if (!client) return null;

  try {
    const response = await client.chat.completions.create({
      model: "sonar",
      messages: [
        {
          role: "system",
          content: `Bạn là chuyên gia thuế doanh nghiệp Việt Nam. Trả lời bằng tiếng Việt.
Khi trích dẫn quy định, ghi rõ số hiệu văn bản, điều, khoản.
TUYỆT ĐỐI KHÔNG bịa ra số hiệu văn bản hay quy định không tồn tại.
Nếu không chắc chắn, nói rõ "thông tin tham khảo từ internet, cần kiểm chứng lại".`,
        },
        { role: "user", content: question },
      ],
    } as any);

    const answer = response.choices[0]?.message?.content || "";
    // Perplexity returns citations in the response object
    const citations: string[] = (response as any).citations || [];

    return { answer, citations };
  } catch (err) {
    console.error("Perplexity search error:", err);
    return null;
  }
}

/**
 * Stream search via Perplexity Sonar.
 */
export async function streamPerplexitySearch(options: {
  question: string;
  onChunk: (text: string) => void;
}): Promise<{ fullText: string; citations: string[] }> {
  const client = getPerplexityClient();
  if (!client) throw new Error("PERPLEXITY_API_KEY chưa được cấu hình");

  let fullText = "";
  let citations: string[] = [];

  const stream = await client.chat.completions.create({
    model: "sonar",
    stream: true,
    messages: [
      {
        role: "system",
        content: `Bạn là chuyên gia thuế doanh nghiệp Việt Nam. Trả lời bằng tiếng Việt.
Khi trích dẫn quy định, ghi rõ số hiệu văn bản, điều, khoản.
TUYỆT ĐỐI KHÔNG bịa ra số hiệu văn bản hay quy định không tồn tại.
Nếu không chắc chắn, nói rõ "thông tin tham khảo từ internet, cần kiểm chứng lại".`,
      },
      { role: "user", content: options.question },
    ],
  } as any);

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content || "";
    if (text) {
      fullText += text;
      options.onChunk(text);
    }
    // Capture citations from the last chunk
    if ((chunk as any).citations) {
      citations = (chunk as any).citations;
    }
  }

  return { fullText, citations };
}

// DeepSeek client (OpenAI-compatible API)
function getDeepSeekClient(): OpenAI | null {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key, baseURL: "https://api.deepseek.com" });
}

// Anthropic client
function getAnthropicClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}

// OpenAI client for embeddings
function getOpenAIClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

// Generate embedding for a text
export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getOpenAIClient();
  if (!client) throw new Error("OPENAI_API_KEY chưa được cấu hình cho embedding");

  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text.slice(0, 8000), // Limit input
  });
  return response.data[0].embedding;
}

// Call LLM with system prompt + user message
export async function callLLM(options: {
  model: "deepseek" | "anthropic";
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
}): Promise<string> {
  const { model, systemPrompt, userMessage, maxTokens = 8000 } = options;

  if (model === "anthropic") {
    const client = getAnthropicClient();
    if (!client) throw new Error("ANTHROPIC_API_KEY chưa được cấu hình");

    const response = await client.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    return response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as any).text)
      .join("");
  } else {
    // DeepSeek
    const client = getDeepSeekClient();
    if (!client) throw new Error("DEEPSEEK_API_KEY chưa được cấu hình");

    const response = await client.chat.completions.create({
      model: "deepseek-reasoner",
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });

    return response.choices[0]?.message?.content || "";
  }
}

// Stream LLM response
export async function streamLLM(options: {
  model: "deepseek" | "anthropic";
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
  onChunk: (text: string) => void;
}): Promise<string> {
  const { model, systemPrompt, userMessage, maxTokens = 8000, onChunk } = options;
  let fullText = "";

  if (model === "anthropic") {
    const client = getAnthropicClient();
    if (!client) throw new Error("ANTHROPIC_API_KEY chưa được cấu hình");

    const stream = client.messages.stream({
      model: "claude-3-5-haiku-20241022",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && (event.delta as any).type === "text_delta") {
        const text = (event.delta as any).text;
        fullText += text;
        onChunk(text);
      }
    }
  } else {
    const client = getDeepSeekClient();
    if (!client) throw new Error("DEEPSEEK_API_KEY chưa được cấu hình");

    const stream = await client.chat.completions.create({
      model: "deepseek-reasoner",
      max_tokens: maxTokens,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || "";
      if (text) {
        fullText += text;
        onChunk(text);
      }
    }
  }

  return fullText;
}

// ---- Prompt Templates ----

function buildContextFromChunks(chunks: Array<{ chunk_text: string; article_ref: string | null; document_so_hieu: string; document_ten: string }>): string {
  if (chunks.length === 0) return "Không tìm thấy quy định phù hợp trong cơ sở dữ liệu.";

  return chunks.map((c, i) => {
    const ref = c.article_ref ? ` (${c.article_ref})` : "";
    return `--- Trích dẫn ${i + 1}: ${c.document_so_hieu}${ref} ---\n${c.chunk_text}\n---`;
  }).join("\n\n");
}

export function buildCitationsFromChunks(chunks: Array<{ document_id?: number; chunk_text: string; article_ref: string | null; document_so_hieu: string; document_ten?: string }>): Citation[] {
  const seen = new Set<string>();
  return chunks
    .filter(c => {
      const key = `${c.document_so_hieu}-${c.article_ref || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(c => ({
      document_id: c.document_id || 0,
      so_hieu: c.document_so_hieu,
      article_ref: c.article_ref || "",
      excerpt: c.chunk_text.slice(0, 200) + (c.chunk_text.length > 200 ? "..." : ""),
    }));
}

const BASE_SYSTEM_PROMPT = `Bạn là chuyên gia tư vấn thuế doanh nghiệp Việt Nam với 30 năm kinh nghiệm tại Big 4.
Bạn có kiến thức chuyên sâu về Luật Thuế TNDN, GTGT, TNCN, Thuế nhà thầu, Hóa đơn, và các quy định liên quan.

NGUYÊN TẮC QUAN TRỌNG:
1. ƯU TIÊN trả lời dựa trên các quy định trong phần "QUY ĐỊNH THAM CHIẾU TỪ DATABASE" bên dưới.
2. Nếu có phần "THÔNG TIN BỔ SUNG TỪ INTERNET", đây là tham khảo bổ sung - cần phân biệt rõ nguồn.
3. LUÔN trích dẫn chính xác số hiệu văn bản, điều, khoản, mục khi đề cập đến quy định.
4. Nếu không tìm thấy quy định phù hợp trong cả hai nguồn, nói rõ: "Không tìm thấy quy định cụ thể."
5. TUYỆT ĐỐI KHÔNG bịa ra số hiệu văn bản, điều khoản hay quy định không có trong dữ liệu.
6. Trả lời bằng tiếng Việt, chuyên nghiệp và dễ hiểu.
7. Khi trích dẫn từ database, dùng: "Theo [Điều X, Khoản Y] [Số hiệu văn bản], ..."
8. Khi dùng thông tin từ internet, ghi rõ: "(Nguồn: internet - cần kiểm chứng)".
9. Thông tin từ database luôn đáng tin hơn thông tin từ internet.`;

export function getQuickQAPrompt(context: string, internetContext?: string): string {
  let prompt = `${BASE_SYSTEM_PROMPT}

QUY ĐỊNH THAM CHIẾU TỪ DATABASE:
${context}`;

  if (internetContext) {
    prompt += `\n\nTHÔNG TIN BỔ SUNG TỪ INTERNET (tham khảo, cần kiểm chứng):\n${internetContext}`;
  }

  prompt += `\n\nHãy trả lời câu hỏi thuế một cách ngắn gọn, chính xác, có trích dẫn điều khoản cụ thể.
Format trả lời:
## Trả lời
[Câu trả lời ngắn gọn]

## Căn cứ pháp lý
[Liệt kê các điều khoản được trích dẫn]

## Nguồn tham khảo
[Nếu có sử dụng thông tin từ internet, liệt kê ở đây với ghi chú cần kiểm chứng]`;

  return prompt;
}

export function getScenarioPrompt(context: string, internetContext?: string): string {
  let prompt = `${BASE_SYSTEM_PROMPT}

QUY ĐỊNH THAM CHIẾU TỪ DATABASE:
${context}`;

  if (internetContext) {
    prompt += `\n\nTHÔNG TIN BỔ SUNG TỪ INTERNET (tham khảo, cần kiểm chứng):\n${internetContext}`;
  }

  prompt += `\n\nHãy phân tích tình huống thuế theo cấu trúc:
## Phân tích tình huống
[Tóm tắt vấn đề cần giải quyết]

## Căn cứ pháp lý
[Trích dẫn các quy định liên quan, ghi rõ số hiệu văn bản, điều, khoản]

## Hướng xử lý
[Đề xuất cách xử lý cụ thể]

## Lưu ý
[Các điểm cần chú ý thêm]`;

  return prompt;
}

export function getArticlePrompt(context: string, internetContext?: string): string {
  let prompt = `${BASE_SYSTEM_PROMPT}

QUY ĐỊNH THAM CHIẾU TỪ DATABASE:
${context}`;

  if (internetContext) {
    prompt += `\n\nTHÔNG TIN BỔ SUNG TỪ INTERNET (tham khảo, cần kiểm chứng):\n${internetContext}`;
  }

  prompt += `\n\nHãy viết một bài phân tích chuyên sâu về chủ đề thuế được yêu cầu. Bài viết cần:
1. Có cấu trúc rõ ràng với các mục chính
2. Trích dẫn chính xác các điều khoản pháp luật (ưu tiên từ database)
3. Có ví dụ minh họa thực tế
4. Có phần lưu ý quan trọng
5. Dài khoảng 1500-3000 từ

Format:
# [Tiêu đề bài viết]

## I. Căn cứ pháp lý
[Liệt kê các văn bản quy phạm pháp luật liên quan]

## II. Nội dung phân tích
[Phân tích chi tiết từng vấn đề, có trích dẫn]

## III. Ví dụ thực tế
[Ví dụ minh họa cụ thể với số liệu]

## IV. Lưu ý quan trọng
[Các điểm cần chú ý]

## V. Kết luận
[Tổng kết]`;

  return prompt;
}

export function getTaxAdvicePrompt(context: string, internetContext?: string): string {
  let prompt = `${BASE_SYSTEM_PROMPT}

QUY ĐỊNH THAM CHIẾU TỪ DATABASE:
${context}`;

  if (internetContext) {
    prompt += `\n\nTHÔNG TIN BỔ SUNG TỪ INTERNET (tham khảo, cần kiểm chứng):\n${internetContext}`;
  }

  prompt += `\n\nHãy viết một thư tư vấn thuế chuyên nghiệp (professional tax advice letter) dài khoảng 1-2 trang A4.

Format:
# THƯ TƯ VẤN THUẾ

**Kính gửi:** [Tên khách hàng/công ty nếu có]
**V/v:** [Vấn đề tư vấn]
**Ngày:** [Ngày hiện tại]

---

## I. Vấn đề được tư vấn
[Tóm tắt lại scenario/câu hỏi]

## II. Căn cứ pháp lý
[Trích dẫn các quy định liên quan]

## III. Ý kiến tư vấn
[Phân tích và đưa ra ý kiến tư vấn chuyên môn]

## IV. Khuyến nghị
[Đề xuất hướng xử lý cụ thể]

---
*Lưu ý: Thư tư vấn này dựa trên các quy định pháp luật hiện hành và thông tin được cung cấp. Doanh nghiệp nên tham khảo thêm ý kiến của cơ quan thuế quản lý trực tiếp.*`;

  return prompt;
}

export function getReportTopicPrompt(context: string, topicName: string, reportTitle: string, internetContext?: string): string {
  let prompt = `${BASE_SYSTEM_PROMPT}

QUY ĐỊNH THAM CHIẾU TỪ DATABASE:
${context}`;

  if (internetContext) {
    prompt += `\n\nTHÔNG TIN BỔ SUNG TỪ INTERNET (tham khảo, cần kiểm chứng):\n${internetContext}`;
  }

  prompt += `\n\nBạn đang viết phần "${topicName}" trong báo cáo phân tích tác động thuế: "${reportTitle}".

Hãy viết nội dung phân tích chuyên sâu cho phần này, bao gồm:
1. Các quy định thuế liên quan (trích dẫn chính xác, ưu tiên từ database)
2. Phân tích tác động cụ thể
3. Ví dụ minh họa nếu phù hợp
4. Khuyến nghị

Viết khoảng 500-1000 từ, chuyên nghiệp và có trích dẫn.`;

  return prompt;
}

export { buildContextFromChunks };
