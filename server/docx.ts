import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  ExternalHyperlink, BorderStyle, TableOfContents,
  Header, Footer, PageNumber, NumberFormat,
  IRunOptions, IParagraphOptions,
} from "docx";
import type { Output, Citation } from "@shared/schema";

const TYPE_LABELS: Record<string, string> = {
  quick_qa: "Tra cứu nhanh",
  scenario: "Tình huống thuế",
  article: "Bài phân tích",
  report: "Báo cáo chuyên sâu",
  tax_advice: "Thư tư vấn thuế",
  press_article: "Bài viết báo",
};

const FONT = "Arial";
const PRIMARY_COLOR = "0d5c63";

/**
 * Parse markdown text into docx Paragraph[] array.
 */
function parseMarkdownToParagraphs(md: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const lines = md.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Empty line
    if (!line.trim()) continue;

    // Headings
    if (line.startsWith("### ")) {
      paragraphs.push(new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: parseInlineFormatting(line.slice(4)),
        spacing: { before: 200, after: 100 },
      }));
      continue;
    }
    if (line.startsWith("## ")) {
      paragraphs.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: parseInlineFormatting(line.slice(3)),
        spacing: { before: 300, after: 100 },
      }));
      continue;
    }
    if (line.startsWith("# ")) {
      paragraphs.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: parseInlineFormatting(line.slice(2)),
        spacing: { before: 400, after: 150 },
      }));
      continue;
    }

    // Horizontal rule
    if (/^-{3,}$/.test(line.trim()) || /^\*{3,}$/.test(line.trim())) {
      paragraphs.push(new Paragraph({
        children: [],
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "cccccc" } },
        spacing: { before: 200, after: 200 },
      }));
      continue;
    }

    // Bullet list
    if (/^[-*]\s/.test(line)) {
      paragraphs.push(new Paragraph({
        children: parseInlineFormatting(line.replace(/^[-*]\s/, "")),
        bullet: { level: 0 },
        spacing: { before: 40, after: 40 },
      }));
      continue;
    }

    // Numbered list
    const numMatch = line.match(/^(\d+)\.\s/);
    if (numMatch) {
      paragraphs.push(new Paragraph({
        children: parseInlineFormatting(line.replace(/^\d+\.\s/, "")),
        numbering: { reference: "default-numbering", level: 0 },
        spacing: { before: 40, after: 40 },
      }));
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      paragraphs.push(new Paragraph({
        children: parseInlineFormatting(line.slice(2)),
        indent: { left: 720 },
        border: { left: { style: BorderStyle.SINGLE, size: 3, color: PRIMARY_COLOR } },
        spacing: { before: 100, after: 100 },
      }));
      continue;
    }

    // Regular paragraph
    paragraphs.push(new Paragraph({
      children: parseInlineFormatting(line),
      spacing: { before: 60, after: 60 },
    }));
  }

  return paragraphs;
}

/**
 * Parse inline formatting (bold, italic, links, citation refs).
 */
function parseInlineFormatting(text: string): (TextRun | ExternalHyperlink)[] {
  const runs: (TextRun | ExternalHyperlink)[] = [];

  // Split by bold, italic, links, citation refs
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\)|\[\d+\])/g);

  for (const part of parts) {
    if (!part) continue;

    // Bold **text**
    const boldMatch = part.match(/^\*\*(.+)\*\*$/);
    if (boldMatch) {
      runs.push(new TextRun({ text: boldMatch[1], bold: true, font: FONT, size: 22 }));
      continue;
    }

    // Italic *text*
    const italicMatch = part.match(/^\*(.+)\*$/);
    if (italicMatch) {
      runs.push(new TextRun({ text: italicMatch[1], italics: true, font: FONT, size: 22 }));
      continue;
    }

    // Link [text](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      runs.push(new ExternalHyperlink({
        children: [new TextRun({ text: linkMatch[1], color: PRIMARY_COLOR, underline: {}, font: FONT, size: 22 })],
        link: linkMatch[2],
      }));
      continue;
    }

    // Citation ref [N]
    const citMatch = part.match(/^\[(\d+)\]$/);
    if (citMatch) {
      runs.push(new TextRun({ text: `[${citMatch[1]}]`, superScript: true, color: PRIMARY_COLOR, font: FONT, size: 18 }));
      continue;
    }

    // Plain text
    runs.push(new TextRun({ text: part, font: FONT, size: 22 }));
  }

  return runs;
}

/**
 * Generate DOCX buffer from an Output.
 */
export async function generateDOCX(output: Output): Promise<Buffer> {
  const title = output.title || "TaxAdvice Report";
  const typeLabel = TYPE_LABELS[output.type] || output.type;
  const dateStr = new Date(output.created_at).toLocaleDateString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });

  const sections: Paragraph[] = [];

  // Title
  sections.push(new Paragraph({
    children: [new TextRun({ text: title, bold: true, font: FONT, size: 36, color: PRIMARY_COLOR })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
  }));

  // Meta info
  sections.push(new Paragraph({
    children: [new TextRun({ text: `Loại: ${typeLabel}  |  Ngày: ${dateStr}`, font: FONT, size: 20, color: "888888" })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 300 },
  }));

  // Separator
  sections.push(new Paragraph({
    children: [],
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "cccccc" } },
    spacing: { after: 200 },
  }));

  // Question
  if (output.question) {
    sections.push(new Paragraph({
      children: [new TextRun({ text: "Câu hỏi / Tình huống:", bold: true, font: FONT, size: 20, color: "333333" })],
      spacing: { before: 100 },
    }));
    sections.push(new Paragraph({
      children: [new TextRun({ text: output.question, font: FONT, size: 22, color: "444444" })],
      indent: { left: 360 },
      border: { left: { style: BorderStyle.SINGLE, size: 3, color: PRIMARY_COLOR } },
      spacing: { before: 60, after: 200 },
    }));
  }

  // Main content
  if (output.content) {
    const contentParagraphs = parseMarkdownToParagraphs(output.content);
    sections.push(...contentParagraphs);
  }

  // Citations (only web sources with URLs)
  const citations: Citation[] = output.citations || [];
  const webCitations = citations.filter((c: any) => c.url && c.url.startsWith("http"));
  if (webCitations.length > 0) {
    sections.push(new Paragraph({
      children: [],
      border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "cccccc" } },
      spacing: { before: 400, after: 200 },
    }));
    sections.push(new Paragraph({
      children: [new TextRun({ text: "Nguồn tham khảo từ internet", bold: true, font: FONT, size: 24, color: PRIMARY_COLOR })],
      spacing: { after: 100 },
    }));

    webCitations.forEach((c: any, i) => {
      const children: (TextRun | ExternalHyperlink)[] = [
        new TextRun({ text: `[${i + 1}] `, bold: true, font: FONT, size: 20 }),
      ];
      if (c.url) {
        children.push(new ExternalHyperlink({
          children: [new TextRun({ text: c.url, color: PRIMARY_COLOR, underline: {}, font: FONT, size: 20 })],
          link: c.url,
        }));
      }
      sections.push(new Paragraph({ children, spacing: { before: 40, after: 40 } }));
    });
  }

  // Footer note
  sections.push(new Paragraph({
    children: [],
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "eeeeee" } },
    spacing: { before: 400, after: 100 },
  }));
  sections.push(new Paragraph({
    children: [new TextRun({
      text: "Tài liệu này được tạo bởi TaxAdvice App. Nội dung chỉ mang tính tham khảo.",
      font: FONT, size: 16, color: "999999", italics: true,
    })],
    alignment: AlignmentType.CENTER,
  }));

  const doc = new Document({
    numbering: {
      config: [{
        reference: "default-numbering",
        levels: [{ level: 0, format: NumberFormat.DECIMAL, text: "%1.", alignment: AlignmentType.START }],
      }],
    },
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 22 },
        },
        heading1: {
          run: { font: FONT, size: 32, bold: true, color: PRIMARY_COLOR },
          paragraph: { spacing: { before: 400, after: 150 } },
        },
        heading2: {
          run: { font: FONT, size: 26, bold: true, color: "1a1a1a" },
          paragraph: { spacing: { before: 300, after: 100 } },
        },
        heading3: {
          run: { font: FONT, size: 22, bold: true, color: "333333" },
          paragraph: { spacing: { before: 200, after: 80 } },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            children: [new TextRun({ text: "TaxAdvice — Hệ thống Tư vấn Thuế", font: FONT, size: 16, color: "888888" })],
            alignment: AlignmentType.RIGHT,
          })],
        }),
      },
      children: sections,
    }],
  });

  return await Packer.toBuffer(doc);
}
