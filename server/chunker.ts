import * as cheerio from "cheerio";
import pool from "./db";
import { insertChunk, deleteChunksByDocumentId, updateChunkEmbedding } from "./storage";
import { generateEmbedding } from "./ai";

interface ParsedChunk {
  text: string;
  article_ref: string | null;
  section_path: string | null;
}

/**
 * Parse Vietnamese legal HTML document into chunks by Điều/Khoản/Mục structure.
 * 
 * Vietnamese legal documents follow a hierarchical structure:
 * Phần (Part) > Chương (Chapter) > Mục (Section) > Điều (Article) > Khoản (Clause) > Điểm (Point)
 */
export function parseDocumentHTML(html: string, soHieu: string): ParsedChunk[] {
  const $ = cheerio.load(html);
  const chunks: ParsedChunk[] = [];

  // Remove scripts, styles
  $("script, style, nav, header, footer").remove();

  // Get the text content
  const text = $("body").text() || $.root().text() || html.replace(/<[^>]*>/g, " ");
  
  // Strategy: Split by "Điều" articles first, then create chunks
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  
  let currentChuong = "";
  let currentMuc = "";
  let currentDieu = "";
  let currentKhoan = "";
  let currentBuffer: string[] = [];
  let currentPath: string[] = [];

  const dieuPattern = /^(?:Điều|ĐIỀU)\s+(\d+[a-z]?)[\.\s:]/i;
  const chuongPattern = /^(?:Chương|CHƯƠNG)\s+([IVXLCDM]+|\d+)[\.\s:]/i;
  const mucPattern = /^(?:Mục|MỤC)\s+(\d+)[\.\s:]/i;
  const khoanPattern = /^(\d+)\.\s/;
  const diemPattern = /^([a-zđ])\)\s/;
  const phanPattern = /^(?:Phần|PHẦN)\s+([IVXLCDM]+|\d+)/i;

  function flushChunk() {
    if (currentBuffer.length === 0) return;
    
    const chunkText = currentBuffer.join("\n").trim();
    if (chunkText.length < 20) {
      currentBuffer = [];
      return;
    }

    let articleRef = "";
    if (currentDieu) articleRef = currentDieu;
    if (currentKhoan) articleRef += `, Khoản ${currentKhoan}`;

    const sectionPath = currentPath.filter(Boolean).join(" > ");

    chunks.push({
      text: chunkText.slice(0, 4000), // Limit chunk size
      article_ref: articleRef || null,
      section_path: sectionPath || null,
    });

    currentBuffer = [];
  }

  for (const line of lines) {
    // Check for Phần
    const phanMatch = line.match(phanPattern);
    if (phanMatch) {
      flushChunk();
      currentPath = [`Phần ${phanMatch[1]}`];
      currentChuong = "";
      currentMuc = "";
      currentDieu = "";
      currentKhoan = "";
      currentBuffer.push(line);
      continue;
    }

    // Check for Chương
    const chuongMatch = line.match(chuongPattern);
    if (chuongMatch) {
      flushChunk();
      currentChuong = `Chương ${chuongMatch[1]}`;
      currentPath = currentPath.length > 0 && currentPath[0].startsWith("Phần") 
        ? [currentPath[0], currentChuong] 
        : [currentChuong];
      currentMuc = "";
      currentDieu = "";
      currentKhoan = "";
      currentBuffer.push(line);
      continue;
    }

    // Check for Mục
    const mucMatch = line.match(mucPattern);
    if (mucMatch) {
      flushChunk();
      currentMuc = `Mục ${mucMatch[1]}`;
      const basePath = currentPath.filter(p => !p.startsWith("Mục") && !p.startsWith("Điều"));
      currentPath = [...basePath, currentMuc];
      currentDieu = "";
      currentKhoan = "";
      currentBuffer.push(line);
      continue;
    }

    // Check for Điều
    const dieuMatch = line.match(dieuPattern);
    if (dieuMatch) {
      flushChunk();
      currentDieu = `Điều ${dieuMatch[1]}`;
      currentKhoan = "";
      const basePath = currentPath.filter(p => !p.startsWith("Điều"));
      currentPath = [...basePath, currentDieu];
      currentBuffer.push(line);
      continue;
    }

    // Check for Khoản
    if (currentDieu) {
      const khoanMatch = line.match(khoanPattern);
      if (khoanMatch && parseInt(khoanMatch[1]) <= 50) {
        // Only flush if we have substantial content
        if (currentBuffer.length > 1) {
          flushChunk();
        }
        currentKhoan = khoanMatch[1];
      }
    }

    currentBuffer.push(line);

    // Flush if buffer gets too large
    if (currentBuffer.join("\n").length > 3500) {
      flushChunk();
    }
  }

  // Flush remaining
  flushChunk();

  // If no structured chunks found, split by paragraphs
  if (chunks.length === 0) {
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 50);
    for (let i = 0; i < paragraphs.length; i++) {
      chunks.push({
        text: paragraphs[i].trim().slice(0, 4000),
        article_ref: null,
        section_path: null,
      });
    }
  }

  return chunks;
}

/**
 * Process a single document: parse HTML → create chunks → generate embeddings
 */
export async function processDocument(documentId: number, options?: { skipEmbeddings?: boolean }): Promise<number> {
  // Get document
  const result = await pool.query(
    `SELECT id, so_hieu, noi_dung FROM documents WHERE id = $1`,
    [documentId]
  );
  const doc = result.rows[0];
  if (!doc) throw new Error(`Document ${documentId} not found`);

  // Delete existing chunks
  await deleteChunksByDocumentId(documentId);

  // Parse HTML into chunks
  const parsedChunks = parseDocumentHTML(doc.noi_dung || "", doc.so_hieu);

  // Insert chunks
  for (let i = 0; i < parsedChunks.length; i++) {
    const chunkId = await insertChunk({
      document_id: documentId,
      chunk_text: parsedChunks[i].text,
      chunk_index: i,
      article_ref: parsedChunks[i].article_ref,
      section_path: parsedChunks[i].section_path,
    });

    // Generate and store embedding (if not skipping)
    if (!options?.skipEmbeddings) {
      try {
        const embedding = await generateEmbedding(parsedChunks[i].text);
        await updateChunkEmbedding(chunkId, embedding);
      } catch (err) {
        console.warn(`Failed to generate embedding for chunk ${chunkId}:`, (err as Error).message);
      }
      // Rate limit: pause between embeddings
      if (i > 0 && i % 20 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  console.log(`Processed document ${doc.so_hieu}: ${parsedChunks.length} chunks`);
  return parsedChunks.length;
}

/**
 * Process all documents (or just anchor/important ones)
 */
export async function processAllDocuments(options?: {
  anchorOnly?: boolean;
  skipEmbeddings?: boolean;
  onProgress?: (current: number, total: number, soHieu: string) => void;
}): Promise<{ processed: number; totalChunks: number }> {
  let query = `SELECT id, so_hieu FROM documents`;
  if (options?.anchorOnly) {
    query += ` WHERE is_anchor = TRUE OR importance <= 2`;
  }
  query += ` ORDER BY importance ASC, id`;

  const result = await pool.query(query);
  const docs = result.rows;
  let totalChunks = 0;

  for (let i = 0; i < docs.length; i++) {
    try {
      const count = await processDocument(docs[i].id, { skipEmbeddings: options?.skipEmbeddings });
      totalChunks += count;
      options?.onProgress?.(i + 1, docs.length, docs[i].so_hieu);
    } catch (err) {
      console.error(`Error processing ${docs[i].so_hieu}:`, err);
    }
  }

  return { processed: docs.length, totalChunks };
}
