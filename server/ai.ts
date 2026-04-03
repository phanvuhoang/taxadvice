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
      model: "claude-haiku-4-5",
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
      model: "claude-haiku-4-5",
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

const CITATION_INSTRUCTION = `
HƯỚNG DẪN TRÍCH DẪN (BẮT BUỘC):
- Đánh số tất cả trích dẫn theo format [1], [2], [3]... trong nội dung bài viết.
- Cuối bài liệt kê đầy đủ tất cả nguồn trích dẫn theo số thứ tự dưới dạng:
  ## Nguồn tham khảo
  [1] Tên văn bản, điều khoản, URL nếu có
  [2] ...
- Chỉ đánh số những nguồn thực sự được trích dẫn trong bài.`;

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
9. Thông tin từ database luôn đáng tin hơn thông tin từ internet.
10. Phần "VĂN BẢN PHÁP LUẬT HIỆN HÀNH" liệt kê tất cả các văn bản anchor đang còn hiệu lực cho sắc thuế được hỏi. Bạn PHẢI ưu tiên tham chiếu đến các văn bản này.
11. Chỉ sử dụng thông tin từ internet khi không tìm thấy quy định cụ thể trong các văn bản pháp luật đã cung cấp.
${CITATION_INSTRUCTION}`;

export function getQuickQAPrompt(context: string, internetContext?: string, styleContext?: string, anchorListContext?: string): string {
  let prompt = `${BASE_SYSTEM_PROMPT}`;

  if (anchorListContext) {
    prompt += `\n\nVĂN BẢN PHÁP LUẬT HIỆN HÀNH (văn bản anchor còn hiệu lực cho sắc thuế này):\n${anchorListContext}`;
  }

  prompt += `\n\nQUY ĐỊNH CỤ THỂ LIÊN QUAN:\n${context}`;

  if (internetContext) {
    prompt += `\n\nTHÔNG TIN BỔ SUNG TỪ INTERNET (cần kiểm chứng):\n${internetContext}`;
  }

  if (styleContext) {
    prompt += `\n\nTHAM KHẢO PHONG CÁCH VIẾT TỪ CÁC BÀI MẪU:\n${styleContext}`;
  }

  prompt += `\n\nHãy trả lời câu hỏi thuế một cách ngắn gọn, chính xác, có trích dẫn điều khoản cụ thể.
Format trả lời:
## Trả lời
[Câu trả lời ngắn gọn, dùng [1], [2]... khi trích dẫn]

## Căn cứ pháp lý
[Liệt kê các điều khoản được trích dẫn]

## Nguồn tham khảo
[1] [Tên văn bản - số hiệu - URL nếu có]
[2] ...`;

  return prompt;
}

export function getScenarioPrompt(context: string, internetContext?: string, styleContext?: string, anchorListContext?: string): string {
  let prompt = `${BASE_SYSTEM_PROMPT}`;

  if (anchorListContext) {
    prompt += `\n\nVĂN BẢN PHÁP LUẬT HIỆN HÀNH (văn bản anchor còn hiệu lực cho sắc thuế này):\n${anchorListContext}`;
  }

  prompt += `\n\nQUY ĐỊNH CỤ THỂ LIÊN QUAN:\n${context}`;

  if (internetContext) {
    prompt += `\n\nTHÔNG TIN BỔ SUNG TỪ INTERNET (cần kiểm chứng):\n${internetContext}`;
  }

  if (styleContext) {
    prompt += `\n\nTHAM KHẢO PHONG CÁCH VIẾT TỪ CÁC BÀI MẪU:\n${styleContext}`;
  }

  prompt += `\n\nHãy phân tích tình huống thuế theo cấu trúc:
## Phân tích tình huống
[Tóm tắt vấn đề cần giải quyết]

## Căn cứ pháp lý
[Trích dẫn các quy định liên quan, ghi rõ số hiệu văn bản, điều, khoản. Dùng [1], [2]... cho mỗi nguồn]

## Hướng xử lý
[Đề xuất cách xử lý cụ thể]

## Lưu ý
[Các điểm cần chú ý thêm]

## Nguồn tham khảo
[1] [Tên văn bản - số hiệu - URL nếu có]
[2] ...`;

  return prompt;
}

export function getArticlePrompt(context: string, internetContext?: string, styleContext?: string, anchorListContext?: string): string {
  let prompt = `${BASE_SYSTEM_PROMPT}`;

  if (anchorListContext) {
    prompt += `\n\nVĂN BẢN PHÁP LUẬT HIỆN HÀNH (văn bản anchor còn hiệu lực cho sắc thuế này):\n${anchorListContext}`;
  }

  prompt += `\n\nQUY ĐỊNH CỤ THỂ LIÊN QUAN:\n${context}`;

  if (internetContext) {
    prompt += `\n\nTHÔNG TIN BỔ SUNG TỪ INTERNET (cần kiểm chứng):\n${internetContext}`;
  }

  if (styleContext) {
    prompt += `\n\nTHAM KHẢO PHONG CÁCH VIẾT TỪ CÁC BÀI MẪU:\n${styleContext}`;
  }

  prompt += `\n\nHãy viết một bài phân tích chuyên sâu về chủ đề thuế được yêu cầu. Bài viết cần:
1. Có cấu trúc rõ ràng với các mục chính
2. Trích dẫn chính xác các điều khoản pháp luật với format [1], [2]... (ưu tiên từ database)
3. Có ví dụ minh họa thực tế
4. Có phần lưu ý quan trọng
5. Dài khoảng 1500-3000 từ

Format:
# [Tiêu đề bài viết]

## I. Căn cứ pháp lý
[Liệt kê các văn bản quy phạm pháp luật liên quan]

## II. Nội dung phân tích
[Phân tích chi tiết từng vấn đề, có trích dẫn [1], [2]...]

## III. Ví dụ thực tế
[Ví dụ minh họa cụ thể với số liệu]

## IV. Lưu ý quan trọng
[Các điểm cần chú ý]

## V. Kết luận
[Tổng kết]

## Nguồn tham khảo
[1] [Tên văn bản - số hiệu - URL nếu có]
[2] ...`;

  return prompt;
}

export function getTaxAdvicePrompt(context: string, internetContext?: string, styleContext?: string, anchorListContext?: string): string {
  let prompt = `${BASE_SYSTEM_PROMPT}`;

  if (anchorListContext) {
    prompt += `\n\nVĂN BẢN PHÁP LUẬT HIỆN HÀNH (văn bản anchor còn hiệu lực cho sắc thuế này):\n${anchorListContext}`;
  }

  prompt += `\n\nQUY ĐỊNH CỤ THỂ LIÊN QUAN:\n${context}`;

  if (internetContext) {
    prompt += `\n\nTHÔNG TIN BỔ SUNG TỪ INTERNET (cần kiểm chứng):\n${internetContext}`;
  }

  if (styleContext) {
    prompt += `\n\nTHAM KHẢO PHONG CÁCH VIẾT TỪ CÁC BÀI MẪU:\n${styleContext}`;
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
[Trích dẫn các quy định liên quan, dùng [1], [2]... cho mỗi nguồn]

## III. Ý kiến tư vấn
[Phân tích và đưa ra ý kiến tư vấn chuyên môn]

## IV. Khuyến nghị
[Đề xuất hướng xử lý cụ thể]

## Nguồn tham khảo
[1] [Tên văn bản - số hiệu - URL nếu có]
[2] ...

---
*Lưu ý: Thư tư vấn này dựa trên các quy định pháp luật hiện hành và thông tin được cung cấp. Doanh nghiệp nên tham khảo thêm ý kiến của cơ quan thuế quản lý trực tiếp.*`;

  return prompt;
}

export function getPressArticlePrompt(context: string, internetContext?: string, styleContext?: string, anchorListContext?: string): string {
  let prompt = `${BASE_SYSTEM_PROMPT}

Bạn đang viết bài báo theo phong cách báo chí — kể chuyện sinh động, ngôn ngữ gần gũi, dễ hiểu với đại chúng.`;

  if (anchorListContext) {
    prompt += `\n\nVĂN BẢN PHÁP LUẬT HIỆN HÀNH (văn bản anchor còn hiệu lực cho sắc thuế này):\n${anchorListContext}`;
  }

  prompt += `\n\nQUY ĐỊNH CỤ THỂ LIÊN QUAN:\n${context}`;

  if (internetContext) {
    prompt += `\n\nTHÔNG TIN BỔ SUNG TỪ INTERNET (cần kiểm chứng):\n${internetContext}`;
  }

  if (styleContext) {
    prompt += `\n\nTHAM KHẢO PHONG CÁCH VIẾT TỪ CÁC BÀI MẪU:\n${styleContext}`;
  }

  prompt += `\n\nHãy viết bài báo về chủ đề thuế theo phong cách báo chí, storytelling:
1. Mở đầu bằng một tình huống/câu chuyện thực tế để thu hút độc giả
2. Giải thích quy định thuế bằng ngôn ngữ đơn giản, dễ hiểu
3. Dùng ví dụ cụ thể, con số minh họa
4. Trích dẫn với format [1], [2]... khi đề cập quy định
5. Kết thúc với thông điệp rõ ràng, actionable
6. Giọng văn thân thiện, không quá hàn lâm
7. Dài 800-1500 từ

Format:
# [Tiêu đề hấp dẫn]

[Lead paragraph — câu chuyện mở đầu]

## [Tiêu đề phần 1]
[Nội dung, trích dẫn [1], [2]...]

## [Tiêu đề phần 2]
...

## Kết luận
[Thông điệp và hành động gợi ý]

## Nguồn tham khảo
[1] [Tên văn bản - số hiệu - URL nếu có]
[2] ...`;

  return prompt;
}

export function getReportTopicPrompt(
  context: string,
  topicName: string,
  reportTitle: string,
  subTopics?: string[],
  internetContext?: string,
  styleContext?: string,
  anchorListContext?: string
): string {
  let prompt = `${BASE_SYSTEM_PROMPT}`;

  if (anchorListContext) {
    prompt += `\n\nVĂN BẢN PHÁP LUẬT HIỆN HÀNH (văn bản anchor còn hiệu lực cho sắc thuế này):\n${anchorListContext}`;
  }

  prompt += `\n\nQUY ĐỊNH CỤ THỂ LIÊN QUAN:\n${context}`;

  if (internetContext) {
    prompt += `\n\nTHÔNG TIN BỔ SUNG TỪ INTERNET (cần kiểm chứng):\n${internetContext}`;
  }

  if (styleContext) {
    prompt += `\n\nTHAM KHẢO PHONG CÁCH VIẾT TỪ CÁC BÀI MẪU:\n${styleContext}`;
  }

  prompt += `\n\nBạn đang viết phần "${topicName}" trong báo cáo phân tích tác động thuế: "${reportTitle}".`;

  if (subTopics && subTopics.length > 0) {
    prompt += `\n\nPhần này bao gồm các tiểu mục sau:\n${subTopics.map((st, i) => `${i + 1}. ${st}`).join("\n")}`;
    prompt += `\n\nHãy viết nội dung đầy đủ cho từng tiểu mục trên, sử dụng format heading ### cho mỗi tiểu mục.`;
  }

  prompt += `\n\nHãy viết nội dung phân tích chuyên sâu cho phần này, bao gồm:
1. Các quy định thuế liên quan (trích dẫn chính xác với [1], [2]..., ưu tiên từ database)
2. Phân tích tác động cụ thể
3. Ví dụ minh họa nếu phù hợp
4. Khuyến nghị

Viết khoảng 800-1500 từ, chuyên nghiệp và có trích dẫn.

## Nguồn tham khảo
[1] [Tên văn bản - số hiệu - URL nếu có]
[2] ...`;

  return prompt;
}

export { buildContextFromChunks };
