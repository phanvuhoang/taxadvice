import PDFDocument from "pdfkit";
import type { Output, Citation } from "@shared/schema";

// Vietnamese-safe PDF generation
export function generatePDF(output: Output): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 60, bottom: 60, left: 60, right: 60 },
        info: {
          Title: output.title || "TaxAdvice Report",
          Author: "TaxAdvice",
          Creator: "TaxAdvice App",
        },
      });

      const buffers: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      // Header
      doc.fontSize(10).fillColor("#666666")
        .text("TaxAdvice - Hệ thống Tư vấn Thuế", { align: "right" });
      doc.moveDown(0.5);
      doc.moveTo(60, doc.y).lineTo(535, doc.y).stroke("#cccccc");
      doc.moveDown(1);

      // Title
      doc.fontSize(18).fillColor("#0d5c63")
        .text(output.title || "Báo cáo Tư vấn Thuế", { align: "center" });
      doc.moveDown(0.3);

      // Type & Date
      const typeLabels: Record<string, string> = {
        quick_qa: "Tra cứu nhanh",
        scenario: "Tình huống thuế",
        article: "Bài phân tích",
        report: "Báo cáo chuyên sâu",
        tax_advice: "Thư tư vấn thuế",
      };
      doc.fontSize(10).fillColor("#888888")
        .text(`Loại: ${typeLabels[output.type] || output.type}  |  Ngày: ${new Date(output.created_at).toLocaleDateString("vi-VN")}`, { align: "center" });
      doc.moveDown(1);
      doc.moveTo(60, doc.y).lineTo(535, doc.y).stroke("#cccccc");
      doc.moveDown(1);

      // Question (if exists)
      if (output.question) {
        doc.fontSize(11).fillColor("#333333").font("Helvetica-Bold")
          .text("Câu hỏi / Tình huống:");
        doc.fontSize(11).fillColor("#444444").font("Helvetica")
          .text(output.question);
        doc.moveDown(1);
      }

      // Main content - simple markdown to PDF
      if (output.content) {
        renderMarkdownToPDF(doc, output.content);
      }

      // Citations
      const citations: Citation[] = output.citations || [];
      if (citations.length > 0) {
        doc.moveDown(1);
        doc.moveTo(60, doc.y).lineTo(535, doc.y).stroke("#cccccc");
        doc.moveDown(0.5);
        doc.fontSize(12).fillColor("#0d5c63").font("Helvetica-Bold")
          .text("Văn bản tham chiếu:");
        doc.moveDown(0.3);

        citations.forEach((c, i) => {
          doc.fontSize(9).fillColor("#333333").font("Helvetica")
            .text(`${i + 1}. ${c.so_hieu}${c.article_ref ? ` - ${c.article_ref}` : ""}`, {
              continued: false,
            });
        });
      }

      // Footer
      doc.moveDown(2);
      doc.fontSize(8).fillColor("#999999")
        .text("Tài liệu này được tạo bởi TaxAdvice App. Nội dung chỉ mang tính tham khảo, không thay thế tư vấn chuyên môn.", {
          align: "center",
        });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function renderMarkdownToPDF(doc: typeof PDFDocument.prototype, content: string) {
  const lines = content.split("\n");

  for (const line of lines) {
    // Check page space
    if (doc.y > 720) {
      doc.addPage();
    }

    // H1
    if (line.startsWith("# ")) {
      doc.moveDown(0.5);
      doc.fontSize(16).fillColor("#0d5c63").font("Helvetica-Bold")
        .text(line.replace(/^# /, ""));
      doc.moveDown(0.3);
      continue;
    }

    // H2
    if (line.startsWith("## ")) {
      doc.moveDown(0.5);
      doc.fontSize(13).fillColor("#1a1a1a").font("Helvetica-Bold")
        .text(line.replace(/^## /, ""));
      doc.moveDown(0.2);
      continue;
    }

    // H3
    if (line.startsWith("### ")) {
      doc.moveDown(0.3);
      doc.fontSize(11).fillColor("#333333").font("Helvetica-Bold")
        .text(line.replace(/^### /, ""));
      doc.moveDown(0.2);
      continue;
    }

    // HR
    if (line.match(/^-{3,}$/)) {
      doc.moveDown(0.3);
      doc.moveTo(60, doc.y).lineTo(535, doc.y).stroke("#dddddd");
      doc.moveDown(0.3);
      continue;
    }

    // Bold text
    let text = line.replace(/\*\*(.*?)\*\*/g, "$1");

    // Bullet points
    if (line.match(/^[-*]\s/)) {
      doc.fontSize(10).fillColor("#333333").font("Helvetica")
        .text(`  •  ${text.replace(/^[-*]\s/, "")}`, { indent: 10 });
      continue;
    }

    // Numbered list
    if (line.match(/^\d+\.\s/)) {
      doc.fontSize(10).fillColor("#333333").font("Helvetica")
        .text(`  ${text}`, { indent: 10 });
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      doc.moveDown(0.3);
      continue;
    }

    // Regular paragraph
    doc.fontSize(10).fillColor("#333333").font("Helvetica")
      .text(text);
  }
}
