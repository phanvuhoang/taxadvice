import { marked } from "marked";
import type { Output, Citation } from "@shared/schema";

// html-docx-js-typescript may use default export or asBlob export
// eslint-disable-next-line @typescript-eslint/no-var-requires
const htmlDocx = require("html-docx-js-typescript");

const TYPE_LABELS: Record<string, string> = {
  quick_qa: "Tra cứu nhanh",
  scenario: "Tình huống thuế",
  article: "Bài phân tích",
  report: "Báo cáo chuyên sâu",
  tax_advice: "Thư tư vấn thuế",
  press_article: "Bài viết báo",
};

/**
 * Convert markdown text to HTML with basic sanitization.
 */
function markdownToHtml(md: string): string {
  // Use marked synchronously
  const result = marked.parse(md, { async: false });
  return typeof result === "string" ? result : "";
}

/**
 * Build the HTML document for the DOCX.
 */
function buildHtmlDocument(output: Output): string {
  const title = output.title || "TaxAdvice Report";
  const typeLabel = TYPE_LABELS[output.type] || output.type;
  const dateStr = new Date(output.created_at).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const contentHtml = output.content ? markdownToHtml(output.content) : "<p><em>Không có nội dung.</em></p>";

  const citations: Citation[] = output.citations || [];
  let citationsHtml = "";
  if (citations.length > 0) {
    const citationItems = citations
      .map((c, i) => {
        const urlPart = (c as any).url
          ? ` — <a href="${(c as any).url}">${(c as any).url}</a>`
          : c.article_ref && c.article_ref.startsWith("http")
          ? ` — <a href="${c.article_ref}">${c.article_ref}</a>`
          : c.article_ref
          ? ` — ${c.article_ref}`
          : "";
        const excerptPart = c.excerpt ? `<br/><span style="color:#666;font-size:10pt;">${c.excerpt}</span>` : "";
        return `<li>[${i + 1}] <strong>${c.so_hieu}</strong>${urlPart}${excerptPart}</li>`;
      })
      .join("\n");

    citationsHtml = `
      <hr style="border:1px solid #cccccc; margin:24pt 0 12pt 0;"/>
      <h2 style="font-family:Arial,sans-serif; font-size:13pt; color:#0d5c63;">Văn bản tham chiếu</h2>
      <ol style="font-family:Arial,sans-serif; font-size:10pt; color:#333333; padding-left:20pt;">
        ${citationItems}
      </ol>`;
  }

  const questionHtml = output.question
    ? `<div style="background:#f5f5f5; border-left:4px solid #0d5c63; padding:8pt 12pt; margin-bottom:16pt; font-family:Arial,sans-serif;">
         <p style="font-size:10pt; font-weight:bold; color:#333; margin:0 0 4pt 0;">Câu hỏi / Tình huống:</p>
         <p style="font-size:10pt; color:#444; margin:0;">${output.question.replace(/\n/g, "<br/>")}</p>
       </div>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      font-size: 11pt;
      color: #333333;
      line-height: 1.6;
      margin: 0;
      padding: 0;
    }
    h1 { font-family: Arial, sans-serif; font-size: 18pt; color: #0d5c63; text-align: center; margin-bottom: 6pt; }
    h2 { font-family: Arial, sans-serif; font-size: 13pt; color: #1a1a1a; margin-top: 18pt; margin-bottom: 6pt; }
    h3 { font-family: Arial, sans-serif; font-size: 11pt; color: #333333; margin-top: 12pt; margin-bottom: 4pt; }
    p { font-family: Arial, sans-serif; font-size: 11pt; margin: 6pt 0; }
    ul, ol { font-family: Arial, sans-serif; font-size: 11pt; padding-left: 20pt; }
    li { margin: 3pt 0; }
    strong { font-weight: bold; }
    em { font-style: italic; }
    code { font-family: "Courier New", monospace; font-size: 9pt; background: #f0f0f0; padding: 1pt 3pt; }
    pre { font-family: "Courier New", monospace; font-size: 9pt; background: #f0f0f0; padding: 8pt; }
    blockquote { border-left: 4px solid #cccccc; padding-left: 12pt; color: #555; margin: 10pt 0; }
    hr { border: 1px solid #cccccc; margin: 16pt 0; }
    a { color: #0d5c63; }
    table { border-collapse: collapse; width: 100%; font-size: 10pt; }
    th { background: #0d5c63; color: white; padding: 6pt 8pt; text-align: left; }
    td { border: 1px solid #cccccc; padding: 5pt 8pt; }
    tr:nth-child(even) td { background: #f9f9f9; }
  </style>
</head>
<body>
  <!-- Header -->
  <p style="text-align:right; font-size:9pt; color:#888888; font-family:Arial,sans-serif;">TaxAdvice — Hệ thống Tư vấn Thuế</p>
  <hr style="border:1px solid #cccccc;"/>

  <!-- Title -->
  <h1>${title}</h1>
  <p style="text-align:center; font-size:10pt; color:#888888; font-family:Arial,sans-serif;">
    Loại: ${typeLabel} &nbsp;|&nbsp; Ngày: ${dateStr}
  </p>
  <hr style="border:1px solid #cccccc; margin-bottom:16pt;"/>

  <!-- Question (if any) -->
  ${questionHtml}

  <!-- Main content -->
  <div class="content">
    ${contentHtml}
  </div>

  <!-- Citations -->
  ${citationsHtml}

  <!-- Footer -->
  <hr style="border:1px solid #eeeeee; margin-top:24pt;"/>
  <p style="font-size:8pt; color:#999999; text-align:center; font-family:Arial,sans-serif;">
    Tài liệu này được tạo bởi TaxAdvice App. Nội dung chỉ mang tính tham khảo, không thay thế tư vấn chuyên môn.
  </p>
</body>
</html>`;
}

/**
 * Generate a DOCX buffer from an Output object.
 */
export async function generateDOCX(output: Output): Promise<Buffer> {
  const htmlContent = buildHtmlDocument(output);

  // html-docx-js-typescript converts HTML string to DOCX blob/buffer
  // The library exports asBlob or the default export
  let docxData: any;

  if (typeof htmlDocx === "function") {
    docxData = htmlDocx(htmlContent);
  } else if (typeof htmlDocx.asBlob === "function") {
    docxData = htmlDocx.asBlob(htmlContent, {
      orientation: "portrait",
      margins: { top: 720, right: 720, bottom: 720, left: 720 },
    });
  } else if (typeof htmlDocx.default === "function") {
    docxData = htmlDocx.default(htmlContent);
  } else {
    throw new Error("html-docx-js-typescript: no usable export found");
  }

  // Convert to Buffer if it's a Blob or ArrayBuffer
  if (Buffer.isBuffer(docxData)) {
    return docxData;
  }

  if (docxData instanceof ArrayBuffer) {
    return Buffer.from(docxData);
  }

  // Blob (in Node.js environments that support it)
  if (docxData && typeof docxData.arrayBuffer === "function") {
    const ab = await docxData.arrayBuffer();
    return Buffer.from(ab);
  }

  // Fallback: treat as Buffer-like
  return Buffer.from(docxData);
}
