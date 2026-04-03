import type { Express } from "express";
import { createServer, type Server } from "http";
import { v4 as uuidv4 } from "uuid";
import * as storage from "./storage";
import pool from "./db";
import { requireAuth, requireAdmin, generateToken } from "./auth";
import { sendPasswordResetEmail } from "./email";
import {
  generateEmbedding, callLLM, streamLLM,
  buildContextFromChunks, buildCitationsFromChunks,
  getQuickQAPrompt, getScenarioPrompt, getArticlePrompt,
  getTaxAdvicePrompt, getReportTopicPrompt, getPressArticlePrompt,
  searchWithPerplexity,
} from "./ai";
import { processDocument, processAllDocuments } from "./chunker";
import { generateDOCX } from "./docx";
import { getDefaultFrame } from "./report-frames";
import { createGammaPresentation, checkGammaStatus } from "./gamma";
import {
  registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema,
  quickQASchema, scenarioSchema, articleSchema, pressArticleSchema,
  reportSchema, topicSchema, taxAdviceSchema,
} from "@shared/schema";
import {
  corpusPool, searchCorpus, searchCorpusChunks, getDocumentBySoHieu, getDocumentChunks, getAnchorDocuments, stripHtml,
} from "./corpus";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ========== AUTH ROUTES ==========

  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = registerSchema.parse(req.body);
      const existing = await storage.getUserByEmail(data.email);
      if (existing) {
        return res.status(400).json({ message: "Email đã được sử dụng" });
      }
      const user = await storage.createUser(data.email, data.password, data.name);
      const token = generateToken(user);
      res.json({ user, token });
    } catch (err: any) {
      if (err.name === "ZodError") {
        return res.status(400).json({ message: err.errors[0]?.message || "Dữ liệu không hợp lệ" });
      }
      console.error("Register error:", err);
      res.status(400).json({ message: err.message || "Đăng ký thất bại" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);
      const user = await storage.getUserByEmail(data.email);
      if (!user) {
        console.log(`Login failed: email not found - ${data.email}`);
        return res.status(401).json({ message: "Email hoặc mật khẩu không đúng" });
      }
      const valid = await storage.verifyPassword(user, data.password);
      if (!valid) {
        console.log(`Login failed: wrong password for ${data.email}`);
        return res.status(401).json({ message: "Email hoặc mật khẩu không đúng" });
      }
      const { password_hash, ...publicUser } = user;
      const token = generateToken(publicUser);
      console.log(`Login success: ${data.email} (role: ${publicUser.role})`);
      res.json({ user: publicUser, token });
    } catch (err: any) {
      console.error("Login error:", err);
      if (err.name === "ZodError") {
        return res.status(400).json({ message: err.errors[0]?.message || "Dữ liệu không hợp lệ" });
      }
      res.status(400).json({ message: `Đăng nhập thất bại: ${err.message}` });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = forgotPasswordSchema.parse(req.body);
      const user = await storage.getUserByEmail(email);
      if (user) {
        const token = uuidv4();
        await storage.createPasswordReset(user.id, token);
        const appUrl = req.headers.origin || `${req.protocol}://${req.headers.host}`;
        await sendPasswordResetEmail(email, token, appUrl);
      }
      // Always return success to prevent email enumeration
      res.json({ message: "Nếu email tồn tại, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu." });
    } catch (err: any) {
      res.status(400).json({ message: "Yêu cầu không hợp lệ" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = resetPasswordSchema.parse(req.body);
      const reset = await storage.getPasswordReset(token);
      if (!reset) {
        return res.status(400).json({ message: "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn" });
      }
      await storage.updatePassword(reset.user_id, password);
      await storage.markResetUsed(token);
      res.json({ message: "Mật khẩu đã được đặt lại thành công" });
    } catch (err: any) {
      res.status(400).json({ message: "Đặt lại mật khẩu thất bại" });
    }
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    const user = await storage.getUserById(req.user!.id);
    if (!user) return res.status(404).json({ message: "Người dùng không tồn tại" });
    res.json(user);
  });

  // ========== DOCUMENTS ROUTES ==========

  app.get("/api/documents", requireAuth, async (req, res) => {
    try {
      const { sac_thue, loai, search, anchor_only } = req.query;

      const params: any[] = [];
      let where = `WHERE 1=1`;
      let idx = 1;

      if (sac_thue && sac_thue !== "all") {
        where += ` AND $${idx} = ANY(sac_thue)`;
        params.push(sac_thue); idx++;
      }
      if (loai && loai !== "all") {
        where += ` AND loai = $${idx}`;
        params.push(loai); idx++;
      }
      if (anchor_only === "true") {
        where += ` AND is_anchor = TRUE`;
      }
      if (search) {
        where += ` AND (ten ILIKE $${idx} OR so_hieu ILIKE $${idx})`;
        params.push(`%${search}%`); idx++;
      }

      const sql = `
        SELECT id, so_hieu, ten, loai, co_quan, ngay_ban_hanh, hieu_luc_tu,
               het_hieu_luc_tu, tinh_trang, sac_thue, chu_de, tom_tat,
               link_tvpl, importance, is_anchor, keywords
        FROM documents
        ${where}
        ORDER BY is_anchor DESC, importance ASC, ngay_ban_hanh DESC
        LIMIT 200
      `;

      const result = await corpusPool.query(sql, params);
      res.json(result.rows);
    } catch (err) {
      console.error("Documents list error:", err);
      res.status(500).json({ message: "Lỗi tải danh sách văn bản" });
    }
  });

  app.get("/api/documents/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const docResult = await corpusPool.query(
        `SELECT * FROM documents WHERE id = $1`, [parseInt(id)]
      );
      if (!docResult.rows[0]) return res.status(404).json({ message: "Không tìm thấy văn bản" });

      const chunksResult = await corpusPool.query(
        `SELECT id, doc_id, so_hieu, chunk_index, dieu_so, dieu_ten, khoan_so,
                chunk_level, header_path, text_content, char_count
         FROM document_chunks WHERE doc_id = $1 ORDER BY chunk_index LIMIT 100`,
        [parseInt(id)]
      );

      res.json({ document: docResult.rows[0], chunks: chunksResult.rows });
    } catch (err) {
      res.status(500).json({ message: "Lỗi tải văn bản" });
    }
  });

  // ========== OUTPUTS ROUTES ==========

  app.get("/api/outputs", requireAuth, async (req, res) => {
    try {
      const result = await storage.getOutputsByUserId(req.user!.id, {
        type: String(req.query.type || ""),
        limit: parseInt(String(req.query.limit || "")) || 20,
        offset: parseInt(String(req.query.offset || "")) || 0,
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({ message: "Lỗi tải danh sách kết quả" });
    }
  });

  app.get("/api/outputs/:id", requireAuth, async (req, res) => {
    try {
      const output = await storage.getOutputById(parseInt(String(req.params.id)));
      if (!output) return res.status(404).json({ message: "Không tìm thấy" });
      res.json(output);
    } catch (err) {
      res.status(400).json({ message: "Lỗi tải kết quả" });
    }
  });

  app.delete("/api/outputs/:id", requireAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteOutput(parseInt(String(req.params.id)), req.user!.id);
      if (!deleted) return res.status(404).json({ message: "Không tìm thấy hoặc không có quyền" });
      res.json({ message: "Đã xóa" });
    } catch (err) {
      res.status(400).json({ message: "Lỗi xóa" });
    }
  });

  // ========== EXPORT ROUTES ==========

  // DOCX export — primary export format
  app.get("/api/outputs/:id/export/docx", requireAuth, async (req, res) => {
    try {
      const output = await storage.getOutputById(parseInt(String(req.params.id)));
      if (!output) return res.status(404).json({ message: "Không tìm thấy" });

      const docxBuffer = await generateDOCX(output);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="taxadvice-${output.id}.docx"`);
      res.send(docxBuffer);
    } catch (err) {
      console.error("DOCX export error:", err);
      res.status(400).json({ message: "Lỗi xuất Word" });
    }
  });

  // PDF export — redirect to DOCX for backward compatibility
  app.get("/api/outputs/:id/export/pdf", requireAuth, async (req, res) => {
    try {
      const output = await storage.getOutputById(parseInt(String(req.params.id)));
      if (!output) return res.status(404).json({ message: "Không tìm thấy" });

      // Redirect to DOCX endpoint
      res.redirect(307, `/api/outputs/${output.id}/export/docx`);
    } catch (err) {
      console.error("PDF/DOCX export redirect error:", err);
      res.status(400).json({ message: "Lỗi xuất tài liệu" });
    }
  });

  // ========== GAMMA ROUTES ==========

  // POST /api/outputs/:id/gamma — start Gamma generation
  app.post("/api/outputs/:id/gamma", requireAuth, async (req, res) => {
    try {
      const outputId = parseInt(String(req.params.id));
      const output = await storage.getOutputById(outputId);
      if (!output) return res.status(404).json({ message: "Không tìm thấy" });
      if (!output.content) return res.status(400).json({ message: "Output chưa có nội dung" });

      const numCards = req.body.numCards || Math.min(30, Math.max(5, Math.floor(output.content.length / 800)));

      const generationId = await createGammaPresentation(
        output.title || "Báo cáo thuế",
        output.content,
        numCards
      );

      // Save generationId to output metadata
      const currentMeta = output.metadata || {};
      await storage.updateOutput(outputId, {
        metadata: {
          ...currentMeta,
          gamma_generation_id: generationId,
          gamma_status: "processing",
        },
      });

      res.json({ generationId, status: "processing" });
    } catch (err: any) {
      console.error("Gamma start error:", err);
      res.status(400).json({ message: err.message || "Lỗi tạo Gamma slide" });
    }
  });

  // GET /api/outputs/:id/gamma/status — check Gamma generation status
  app.get("/api/outputs/:id/gamma/status", requireAuth, async (req, res) => {
    try {
      const outputId = parseInt(String(req.params.id));
      const output = await storage.getOutputById(outputId);
      if (!output) return res.status(404).json({ message: "Không tìm thấy" });

      const generationId = output.metadata?.gamma_generation_id;
      if (!generationId) {
        return res.status(404).json({ message: "Chưa bắt đầu tạo Gamma" });
      }

      const result = await checkGammaStatus(generationId);

      // Update metadata if completed
      if (result.status === "completed" && result.gammaUrl) {
        const currentMeta = output.metadata || {};
        await storage.updateOutput(outputId, {
          metadata: {
            ...currentMeta,
            gamma_status: "completed",
            gamma_url: result.gammaUrl,
            gamma_pptx_url: result.pptxUrl,
          },
        });
      }

      res.json(result);
    } catch (err: any) {
      console.error("Gamma status error:", err);
      res.status(400).json({ message: err.message || "Lỗi kiểm tra trạng thái Gamma" });
    }
  });

  // ========== AI ROUTES ==========

  /**
   * Fetch and extract text content from a URL for style references.
   */
  async function fetchStyleContent(url: string): Promise<string> {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "TaxAdvice/1.0" },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return "";
      const html = await response.text();
      // Strip HTML and return first 3000 chars
      return stripHtml(html).slice(0, 3000);
    } catch {
      return "";
    }
  }

  /**
   * Build style context from style_references (URLs or text).
   */
  async function buildStyleContext(styleRefs?: string[]): Promise<string> {
    if (!styleRefs || styleRefs.length === 0) return "";

    const parts: string[] = [];
    for (const ref of styleRefs.slice(0, 5)) {
      if (ref.startsWith("http://") || ref.startsWith("https://")) {
        const content = await fetchStyleContent(ref);
        if (content) {
          parts.push(`--- Bài mẫu từ ${ref} ---\n${content}`);
        }
      } else {
        // Direct text
        parts.push(`--- Bài mẫu ---\n${ref.slice(0, 3000)}`);
      }
    }

    return parts.join("\n\n");
  }

  // Helper: search + generate with anchor-first search
  async function searchAndGenerate(options: {
    question: string;
    sac_thue?: string[];
    ai_model: "deepseek" | "anthropic";
    promptBuilder: (context: string, internetContext?: string, styleContext?: string, anchorListContext?: string) => string;
    type: string;
    title: string;
    userId: number;
    res: any;
    style_references?: string[];
  }) {
    const { question, sac_thue, ai_model, promptBuilder, type, title, userId, res: response, style_references } = options;

    try {
      // Step A: ALWAYS get anchor documents for the selected sac_thue first
      let anchorListContext = "";
      let anchorDocs: any[] = [];
      if (process.env.CORPUS_DATABASE_URL) {
        try {
          anchorDocs = await getAnchorDocuments(sac_thue);
          if (anchorDocs.length > 0) {
            const anchorLines = anchorDocs.map((doc: any) => {
              const tinhTrang = doc.tinh_trang ? ` [${doc.tinh_trang}]` : "";
              const sacThueStr = doc.sac_thue && doc.sac_thue.length > 0 ? ` (${doc.sac_thue.join(", ")})` : "";
              return `• ${doc.so_hieu} — ${doc.ten}${tinhTrang}${sacThueStr}`;
            });
            anchorListContext = anchorLines.join("\n");
            console.log(`[Anchor] Found ${anchorDocs.length} anchor documents for sac_thue: ${JSON.stringify(sac_thue)}`);
          }
        } catch (err) {
          console.warn("Anchor document fetch failed (non-blocking):", (err as Error).message);
        }
      }

      // Step B: Search corpus chunks from anchor documents for the specific question
      // Try multiple search strategies: anchor-only first, then all docs if needed
      let corpusContext = "";
      let corpusChunkCount = 0;
      let dbHasResults = false;

      if (process.env.CORPUS_DATABASE_URL) {
        try {
          // Strategy 1: Search chunks from anchor documents only
          let corpusChunks = await searchCorpusChunks(question, {
            sacThue: sac_thue,
            limit: 12,
            anchorOnly: true,
          });
          console.log(`[Corpus] Anchor-only search: ${corpusChunks.length} chunks`);

          // Strategy 2: If anchor-only returns few results, also search all documents
          if (corpusChunks.length < 3) {
            const allChunks = await searchCorpusChunks(question, {
              sacThue: sac_thue,
              limit: 12,
              anchorOnly: false,
            });
            console.log(`[Corpus] All-docs search: ${allChunks.length} chunks`);
            // Merge, deduplicate by chunk_id
            const seenIds = new Set(corpusChunks.map(c => c.chunk_id));
            for (const c of allChunks) {
              if (!seenIds.has(c.chunk_id)) {
                corpusChunks.push(c);
                seenIds.add(c.chunk_id);
              }
            }
          }

          // Strategy 3: If FTS still returns nothing, try a broader keyword search
          if (corpusChunks.length === 0) {
            // Extract key tax terms from the question for a simpler search
            const keywords = question.split(/\s+/).filter(w => w.length > 3).slice(0, 5).join(" | ");
            if (keywords) {
              try {
                const broadChunks = await corpusPool.query(`
                  SELECT c.id AS chunk_id, c.doc_id, c.so_hieu, d.ten, c.dieu_so, c.dieu_ten,
                    c.header_path, c.text_content, d.link_tvpl, 0.1 AS rank
                  FROM document_chunks c
                  JOIN documents d ON d.id = c.doc_id
                  WHERE d.is_anchor = TRUE AND d.tinh_trang = 'con_hieu_luc'
                    ${sac_thue && sac_thue.length > 0 ? `AND d.sac_thue && $2::varchar[]` : ""}
                    AND c.text_content ILIKE $1
                  LIMIT 8
                `, sac_thue && sac_thue.length > 0 
                  ? [`%${question.split(/\s+/).filter(w => w.length > 3)[0]}%`, sac_thue]
                  : [`%${question.split(/\s+/).filter(w => w.length > 3)[0]}%`]
                );
                corpusChunks.push(...broadChunks.rows);
                console.log(`[Corpus] Broad ILIKE search: ${broadChunks.rows.length} chunks`);
              } catch (e) {
                console.warn("Broad search failed:", (e as Error).message);
              }
            }
          }

          if (corpusChunks.length > 0) {
            dbHasResults = true;
            corpusChunkCount = corpusChunks.length;
            const chunkLines = corpusChunks.map((c, i) => {
              const ref = c.dieu_so
                ? ` — ${c.dieu_so}${c.dieu_ten ? `: ${c.dieu_ten}` : ""}`
                : c.header_path ? ` — ${c.header_path}` : "";
              return `[Trích ${i+1}] ${c.so_hieu}${ref}\n${c.text_content.slice(0, 1000)}${c.text_content.length > 1000 ? "..." : ""}`;
            });
            corpusContext = chunkLines.join("\n\n");
          }
          console.log(`[Corpus] Final: ${corpusChunkCount} chunks found`);
        } catch (err) {
          console.warn("Corpus chunk search failed (non-blocking):", (err as Error).message);
        }
      }

      // If we have anchor docs, that counts as having DB results even without chunk matches
      if (anchorDocs.length > 0) {
        dbHasResults = true;
      }

      // Step C: ONLY use Perplexity when corpus returns 0 chunks AND no anchor docs
      let internetContext: string | undefined;
      let perplexityCitations: string[] = [];

      if (process.env.PERPLEXITY_API_KEY && corpusChunkCount === 0 && anchorDocs.length === 0) {
        try {
          console.log(`[Perplexity] No corpus data at all, searching internet for: ${question.slice(0, 80)}...`);
          const pplxResult = await searchWithPerplexity(question);
          if (pplxResult && pplxResult.answer) {
            internetContext = pplxResult.answer;
            perplexityCitations = pplxResult.citations || [];
            console.log(`[Perplexity] Found ${perplexityCitations.length} citations`);
          }
        } catch (err) {
          console.warn("Perplexity search failed (non-blocking):", (err as Error).message);
        }
      } else if (corpusChunkCount > 0 || anchorDocs.length > 0) {
        console.log(`[Corpus] Has data (${corpusChunkCount} chunks, ${anchorDocs.length} anchor docs) — skipping Perplexity`);
      }

      // Step D: Build style context from references
      const styleContext = await buildStyleContext(style_references);

      // Build final context:
      // 1. If corpus chunks found → use as "QUY ĐỊNH CỤ THỂ LIÊN QUAN"
      // 2. If internet used → include as supplement
      // anchorListContext is ALWAYS included via promptBuilder
      const finalContextText = corpusContext || "Không tìm thấy quy định cụ thể trong văn bản anchor. Hãy dựa vào danh sách văn bản pháp luật hiện hành được cung cấp.";
      const internetCtx = internetContext;

      const systemPrompt = promptBuilder(finalContextText, internetCtx, styleContext || undefined, anchorListContext || undefined);

      // Set up SSE for streaming
      response.setHeader("Content-Type", "text/event-stream");
      response.setHeader("Cache-Control", "no-cache");
      response.setHeader("Connection", "keep-alive");

      // Send source info to frontend
      const sources: string[] = [];
      if (dbHasResults || anchorListContext) sources.push("corpus");
      if (internetContext) sources.push("internet");
      response.write(`data: ${JSON.stringify({ type: "sources", sources })}\n\n`);

      let fullContent = "";

      await streamLLM({
        model: ai_model,
        systemPrompt,
        userMessage: question,
        onChunk: (text) => {
          fullContent += text;
          response.write(`data: ${JSON.stringify({ type: "chunk", text })}\n\n`);
        },
      });

      // Save output with citations
      // Web citations from Perplexity have url field; corpus/legal citations do NOT have url
      const webCitations = perplexityCitations.map((url, i) => ({
        document_id: 0,
        so_hieu: `Web ${i + 1}`,
        article_ref: "",
        excerpt: "(Nguồn: internet - cần kiểm chứng)",
        url,
      }));
      const allCitations = [...webCitations];

      const output = await storage.createOutput({
        user_id: userId,
        type: type as any,
        title,
        question,
        content: fullContent,
        citations: allCitations,
        status: "completed",
        ai_model,
        metadata: {
          sources,
          perplexity_used: !!internetContext,
          corpus_chunks_found: corpusChunkCount,
          anchor_docs_found: anchorDocs.length,
        },
      });

      response.write(`data: ${JSON.stringify({ type: "done", output })}\n\n`);
      response.end();

    } catch (err: any) {
      console.error(`AI ${type} error:`, err);
      // Try to send error via SSE if headers already sent
      if (response.headersSent) {
        response.write(`data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`);
        response.end();
      } else {
        response.status(400).json({ message: err.message || `Lỗi tạo ${type}` });
      }
    }
  }



  // Quick Q&A
  app.post("/api/ai/quick-qa", requireAuth, async (req, res) => {
    try {
      const data = quickQASchema.parse(req.body);
      await searchAndGenerate({
        question: data.question,
        sac_thue: data.sac_thue,
        ai_model: data.ai_model,
        promptBuilder: getQuickQAPrompt,
        type: "quick_qa",
        title: data.question.slice(0, 100),
        userId: req.user!.id,
        res,
        style_references: data.style_references,
      });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      res.status(400).json({ message: err.message });
    }
  });

  // Scenario Q&A
  app.post("/api/ai/scenario", requireAuth, async (req, res) => {
    try {
      const data = scenarioSchema.parse(req.body);
      await searchAndGenerate({
        question: data.scenario,
        sac_thue: data.sac_thue,
        ai_model: data.ai_model,
        promptBuilder: getScenarioPrompt,
        type: "scenario",
        title: `Tình huống: ${data.scenario.slice(0, 80)}`,
        userId: req.user!.id,
        res,
        style_references: data.style_references,
      });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      res.status(400).json({ message: err.message });
    }
  });

  // Article generation
  app.post("/api/ai/article", requireAuth, async (req, res) => {
    try {
      const data = articleSchema.parse(req.body);
      await searchAndGenerate({
        question: data.topic,
        sac_thue: data.sac_thue,
        ai_model: data.ai_model,
        promptBuilder: getArticlePrompt,
        type: "article",
        title: data.topic.slice(0, 100),
        userId: req.user!.id,
        res,
        style_references: data.style_references,
      });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      res.status(400).json({ message: err.message });
    }
  });

  // Press article generation (Feature 7)
  app.post("/api/ai/press-article", requireAuth, async (req, res) => {
    try {
      const data = pressArticleSchema.parse(req.body);
      await searchAndGenerate({
        question: data.topic,
        sac_thue: data.sac_thue,
        ai_model: data.ai_model,
        promptBuilder: getPressArticlePrompt,
        type: "press_article",
        title: `Bài báo: ${data.topic.slice(0, 80)}`,
        userId: req.user!.id,
        res,
        style_references: data.style_references,
      });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      res.status(400).json({ message: err.message });
    }
  });

  // Fetch URL content for style reference (Feature 8)
  app.post("/api/ai/fetch-style", requireAuth, async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== "string") {
        return res.status(400).json({ message: "URL không hợp lệ" });
      }

      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        return res.status(400).json({ message: "Chỉ hỗ trợ URL http/https" });
      }

      const fetchResponse = await fetch(url, {
        headers: { "User-Agent": "TaxAdvice/1.0" },
        signal: AbortSignal.timeout(10000),
      });

      if (!fetchResponse.ok) {
        return res.status(400).json({ message: `Không thể tải URL (HTTP ${fetchResponse.status})` });
      }

      const html = await fetchResponse.text();
      const text = stripHtml(html).slice(0, 5000);

      res.json({ url, content: text, length: text.length });
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Lỗi tải URL" });
    }
  });

  // Tax advice letter
  app.post("/api/ai/tax-advice", requireAuth, async (req, res) => {
    try {
      const data = taxAdviceSchema.parse(req.body);
      const question = data.client_name
        ? `Khách hàng: ${data.client_name}${data.company_name ? ` (${data.company_name})` : ""}\n\nTình huống: ${data.scenario}`
        : data.scenario;

      await searchAndGenerate({
        question,
        sac_thue: data.sac_thue,
        ai_model: data.ai_model,
        promptBuilder: getTaxAdvicePrompt,
        type: "tax_advice",
        title: `Tư vấn: ${data.scenario.slice(0, 80)}`,
        userId: req.user!.id,
        res,
        style_references: data.style_references,
      });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      res.status(400).json({ message: err.message });
    }
  });

  // Report generation (background)
  app.post("/api/ai/report", requireAuth, async (req, res) => {
    try {
      const data = reportSchema.parse(req.body);

      // Create output with processing status
      const output = await storage.createOutput({
        user_id: req.user!.id,
        type: "report",
        title: data.title,
        question: data.description,
        status: "processing",
        ai_model: data.ai_model,
        metadata: {
          industry: data.industry,
          company: data.company,
          progress: { current: 0, total: 0, currentTopic: "" },
        },
      });

      res.json({ output, message: "Báo cáo đang được tạo trong nền" });

      // Process in background
      processReportInBackground(output.id, data);
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/ai/report/:id/status", requireAuth, async (req, res) => {
    try {
      const output = await storage.getOutputById(parseInt(String(req.params.id)));
      if (!output) return res.status(404).json({ message: "Không tìm thấy" });

      const topics = await storage.getTopicsByOutputId(output.id);
      res.json({ output, topics });
    } catch (err) {
      res.status(400).json({ message: "Lỗi kiểm tra trạng thái" });
    }
  });

  // ========== REPORT FRAMES ==========

  // GET /api/report-frames/:type — get default frame (industry/company/both)
  app.get("/api/report-frames/:type", requireAuth, async (req, res) => {
    try {
      const type = req.params.type as "industry" | "company" | "both";
      if (!["industry", "company", "both"].includes(type)) {
        return res.status(400).json({ message: "type phải là industry, company, hoặc both" });
      }

      const industry = req.query.industry ? String(req.query.industry) : undefined;
      const company = req.query.company ? String(req.query.company) : undefined;
      const frame = getDefaultFrame(type, industry, company);

      res.json({ frame, type });
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Lỗi tải frame" });
    }
  });

  // ========== REPORT TOPICS ==========

  app.get("/api/reports/:id/topics", requireAuth, async (req, res) => {
    try {
      const topics = await storage.getTopicsByOutputId(parseInt(String(req.params.id)));
      res.json(topics);
    } catch (err) {
      res.status(400).json({ message: "Lỗi tải topics" });
    }
  });

  app.post("/api/reports/:id/topics", requireAuth, async (req, res) => {
    try {
      const data = topicSchema.parse(req.body);
      const topic = await storage.createTopic({
        output_id: parseInt(String(req.params.id)),
        name: data.name,
        parent_id: data.parent_id,
        sort_order: data.sort_order,
      });
      res.json(topic);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Batch create topics from frame (Feature 6)
  app.post("/api/reports/:id/topics/batch", requireAuth, async (req, res) => {
    try {
      const outputId = parseInt(String(req.params.id));
      const output = await storage.getOutputById(outputId);
      if (!output) return res.status(404).json({ message: "Không tìm thấy báo cáo" });

      const { topics } = req.body;
      if (!Array.isArray(topics)) {
        return res.status(400).json({ message: "topics phải là mảng" });
      }

      const created = [];
      for (let i = 0; i < topics.length; i++) {
        const t = topics[i];
        if (!t.name) continue;
        const topic = await storage.createTopic({
          output_id: outputId,
          name: t.name,
          parent_id: t.parent_id || null,
          sort_order: t.sort_order ?? i,
        });
        created.push(topic);
      }

      res.json({ created, count: created.length });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.put("/api/reports/:id/topics/:topicId", requireAuth, async (req, res) => {
    try {
      const topic = await storage.updateTopic(parseInt(String(req.params.topicId)), req.body);
      res.json(topic);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/reports/:id/topics/:topicId", requireAuth, async (req, res) => {
    try {
      await storage.deleteTopic(parseInt(String(req.params.topicId)));
      res.json({ message: "Đã xóa topic" });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // Generate content for a specific topic
  app.post("/api/reports/:id/topics/:topicId/generate", requireAuth, async (req, res) => {
    try {
      const outputId = parseInt(String(req.params.id));
      const topicId = parseInt(String(req.params.topicId));
      const output = await storage.getOutputById(outputId);
      if (!output) return res.status(404).json({ message: "Không tìm thấy báo cáo" });

      const topics = await storage.getTopicsByOutputId(outputId);
      const topic = topics.find(t => t.id === topicId);
      if (!topic) return res.status(404).json({ message: "Không tìm thấy topic" });

      // Update status
      await storage.updateTopic(topicId, { status: "processing" });

      // Search corpus for relevant content
      let contextText = "Không tìm thấy quy định cụ thể.";

      if (process.env.CORPUS_DATABASE_URL) {
        try {
          const corpusChunks = await searchCorpusChunks(topic.name, {
            limit: 10,
            anchorOnly: true,
          });

          if (corpusChunks.length > 0) {
            const chunkLines = corpusChunks.map((c, i) => {
              const ref = c.dieu_so ? ` — ${c.dieu_so}${c.dieu_ten ? `: ${c.dieu_ten}` : ""}` : "";
              const link = c.link_tvpl ? `\n   🔗 ${c.link_tvpl}` : "";
              return `[${i+1}] ${c.so_hieu}${ref}\n${c.text_content.slice(0, 800)}${link}`;
            });
            contextText = chunkLines.join("\n\n");
          }
        } catch (err) {
          console.warn("Corpus search for topic failed:", (err as Error).message);
        }
      }

      // Generate content
      const systemPrompt = getReportTopicPrompt(contextText, topic.name, output.title || "");
      const content = await callLLM({
        model: (output.ai_model as "deepseek" | "anthropic") || "deepseek",
        systemPrompt,
        userMessage: `Viết phần phân tích cho: ${topic.name}`,
      });

      await storage.updateTopic(topicId, { content, status: "completed" });
      res.json({ content, status: "completed" });
    } catch (err: any) {
      console.error("Topic generate error:", err);
      res.status(400).json({ message: err.message });
    }
  });

  // ========== ADMIN ROUTES ==========

  app.get("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (err) {
      res.status(400).json({ message: "Lỗi tải danh sách người dùng" });
    }
  });

  app.put("/api/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      await storage.updateUserRole(parseInt(String(req.params.id)), req.body.role);
      res.json({ message: "Đã cập nhật" });
    } catch (err) {
      res.status(400).json({ message: "Lỗi cập nhật" });
    }
  });

  app.delete("/api/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      await storage.deleteUser(parseInt(String(req.params.id)));
      res.json({ message: "Đã xóa" });
    } catch (err) {
      res.status(400).json({ message: "Lỗi xóa" });
    }
  });

  // Chunk management
  app.get("/api/admin/chunks/stats", requireAuth, requireAdmin, async (req, res) => {
    try {
      const count = await storage.getChunkCount();
      res.json({ total_chunks: count });
    } catch (err) {
      res.status(400).json({ message: "Lỗi" });
    }
  });

  app.post("/api/admin/chunks/rebuild", requireAuth, requireAdmin, async (req, res) => {
    try {
      const anchorOnly = req.body.anchor_only !== false;
      const skipEmbeddings = req.body.skip_embeddings === true;

      res.json({ message: "Đang xử lý trong nền..." });

      // Process in background
      processAllDocuments({
        anchorOnly,
        skipEmbeddings,
        onProgress: (current, total, soHieu) => {
          console.log(`Chunking ${current}/${total}: ${soHieu}`);
        },
      }).then(result => {
        console.log(`Chunking complete: ${result.processed} docs, ${result.totalChunks} chunks`);
      }).catch(err => {
        console.error("Chunking error:", err);
      });
    } catch (err) {
      res.status(400).json({ message: "Lỗi" });
    }
  });

  app.post("/api/admin/chunks/document/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const count = await processDocument(parseInt(String(req.params.id)));
      res.json({ message: `Đã tạo ${count} chunks` });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // ========== CORPUS ROUTES ==========

  app.get("/api/corpus/search", requireAuth, async (req, res) => {
    try {
      const q = String(req.query.q || "").trim();
      if (!q) return res.status(400).json({ message: "Thiếu tham số q" });

      const sacThue = req.query.sacThue
        ? String(req.query.sacThue).split(",").map(s => s.trim()).filter(Boolean)
        : undefined;
      const loai = req.query.loai
        ? String(req.query.loai).split(",").map(s => s.trim()).filter(Boolean)
        : undefined;
      const limit = Math.min(parseInt(String(req.query.limit || "10")) || 10, 50);
      const importanceMax = req.query.importanceMax
        ? parseInt(String(req.query.importanceMax))
        : undefined;
      const anchorOnly = req.query.anchorOnly === "true";

      const results = await searchCorpus(q, { sacThue, loai, limit, importanceMax, anchorOnly });
      res.json({ results, total: results.length, query: q });
    } catch (err: any) {
      console.error("Corpus search error:", err);
      res.status(500).json({ message: "Lỗi tìm kiếm corpus" });
    }
  });

  app.get("/api/corpus/document/:soHieu", requireAuth, async (req, res) => {
    try {
      const soHieu = decodeURIComponent(req.params.soHieu);
      const document = await getDocumentBySoHieu(soHieu);
      if (!document) return res.status(404).json({ message: "Không tìm thấy văn bản" });

      const chunks = await getDocumentChunks(document.id, { limit: 100 });
      const dieuChunks = chunks.filter(c => c.chunk_level === "dieu");
      res.json({ document, chunks: dieuChunks });
    } catch (err: any) {
      console.error("Corpus document error:", err);
      res.status(500).json({ message: "Lỗi tải văn bản corpus" });
    }
  });

  app.get("/api/corpus/anchors", requireAuth, async (req, res) => {
    try {
      const sacThue = req.query.sacThue
        ? String(req.query.sacThue).split(",").map(s => s.trim()).filter(Boolean)
        : undefined;
      const documents = await getAnchorDocuments(sacThue);
      res.json({ documents });
    } catch (err: any) {
      console.error("Corpus anchors error:", err);
      res.status(500).json({ message: "Lỗi tải anchor documents" });
    }
  });

  // ========== HEALTH CHECK ==========
  app.get("/api/health", async (_req, res) => {
    let dbStatus = "unknown";
    let adminEmail = process.env.ADMIN_EMAIL || "admin@taxadvice.vn";
    let adminExists = false;
    try {
      const result = await pool.query(`SELECT id, email, role FROM app_users WHERE email = $1`, [adminEmail]);
      adminExists = result.rows.length > 0;
      dbStatus = "connected";
    } catch (err) {
      dbStatus = `error: ${(err as Error).message}`;
    }

    const corpusDbStatus = await corpusPool.query("SELECT 1").then(() => "ok").catch(e => e.message);

    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      db: dbStatus,
      corpus_db: corpusDbStatus,
      admin_email: adminEmail,
      admin_exists: adminExists,
      env_check: {
        DATABASE_URL: !!process.env.DATABASE_URL,
        CORPUS_DATABASE_URL: !!process.env.CORPUS_DATABASE_URL,
        JWT_SECRET: !!process.env.JWT_SECRET,
        DEEPSEEK_API_KEY: !!process.env.DEEPSEEK_API_KEY,
        ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
        OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
        PERPLEXITY_API_KEY: !!process.env.PERPLEXITY_API_KEY,
        SMTP_HOST: !!process.env.SMTP_HOST,
        GAMMA_API_KEY: !!process.env.GAMMA_API_KEY,
        GAMMA_FOLDER_ID: !!process.env.GAMMA_FOLDER_ID,
      },
    });
  });

  return httpServer;
}

// Background report processing (Feature 6 + Feature 10)
async function processReportInBackground(outputId: number, data: any) {
  try {
    let topicFrames = data.topics as Array<{
      id: string;
      name: string;
      enabled: boolean;
      subTopics: string[];
    }> | undefined;

    const existingTopics = await storage.getTopicsByOutputId(outputId);

    if (existingTopics.length === 0) {
      // Use topics from request data or fallback to defaults
      if (topicFrames && topicFrames.length > 0) {
        const enabledTopics = topicFrames.filter(t => t.enabled !== false);
        for (let i = 0; i < enabledTopics.length; i++) {
          await storage.createTopic({
            output_id: outputId,
            name: enabledTopics[i].name,
            sort_order: i,
          });
        }
      } else {
        // Auto-generate topics if none exist
        const defaultTopics = [
          "Tổng quan quy định thuế liên quan",
          "Phân tích tác động thuế TNDN",
          "Phân tích tác động thuế GTGT",
          "Rủi ro thuế và khuyến nghị",
        ];

        for (let i = 0; i < defaultTopics.length; i++) {
          await storage.createTopic({
            output_id: outputId,
            name: defaultTopics[i],
            sort_order: i,
          });
        }
        topicFrames = defaultTopics.map((name, i) => ({
          id: `T${i}`,
          name,
          enabled: true,
          subTopics: [],
        }));
      }
    }

    // Generate content for each topic
    const allTopics = await storage.getTopicsByOutputId(outputId);
    const total = allTopics.length;
    const contents: string[] = [];

    // Build Table of Contents
    const tocLines = allTopics.map((t, i) => `${i + 1}. ${t.name}`);
    const tocSection = `## Mục lục\n\n${tocLines.join("\n")}\n\n---\n\n`;

    for (let i = 0; i < allTopics.length; i++) {
      const topic = allTopics[i];
      try {
        // Update progress in metadata
        await storage.updateOutput(outputId, {
          metadata: {
            industry: data.industry,
            company: data.company,
            progress: {
              current: i,
              total,
              currentTopic: topic.name,
            },
          },
        });

        await storage.updateTopic(topic.id, { status: "processing" });

        // Find sub-topics for this topic from the frame
        const frameEntry = topicFrames?.find(f => f.name === topic.name || f.id === topic.name);
        const subTopics: string[] = frameEntry?.subTopics || [];

        // Build search query combining topic name + sub-topics
        const searchQuery = subTopics.length > 0
          ? `${data.title} - ${topic.name}: ${subTopics.slice(0, 3).join(", ")}`
          : `${data.title} - ${topic.name}`;

        // Search corpus for relevant anchor documents (Feature 10)
        let contextText = "Không tìm thấy quy định cụ thể.";

        if (process.env.CORPUS_DATABASE_URL) {
          try {
            const corpusChunks = await searchCorpusChunks(searchQuery, {
              limit: 10,
              anchorOnly: true,
            });

            if (corpusChunks.length > 0) {
              const chunkLines = corpusChunks.map((c, idx) => {
                const ref = c.dieu_so ? ` — ${c.dieu_so}${c.dieu_ten ? `: ${c.dieu_ten}` : ""}` : "";
                const link = c.link_tvpl ? `\n   🔗 ${c.link_tvpl}` : "";
                return `[${idx+1}] ${c.so_hieu}${ref}\n${c.text_content.slice(0, 800)}${link}`;
              });
              contextText = chunkLines.join("\n\n");
            }
          } catch (err) {
            console.warn(`Corpus search for topic "${topic.name}" failed:`, (err as Error).message);
          }
        }

        // Generate content with sub-topics
        const systemPrompt = getReportTopicPrompt(contextText, topic.name, data.title, subTopics);
        const userMsg = `Viết phần phân tích cho: ${topic.name}${data.industry ? ` (Ngành: ${data.industry})` : ""}${data.company ? ` (Công ty: ${data.company})` : ""}`;
        const content = await callLLM({
          model: data.ai_model || "deepseek",
          systemPrompt,
          userMessage: userMsg,
        });

        await storage.updateTopic(topic.id, { content, status: "completed" });

        // Format topic content with sub-section headings if sub-topics exist
        let topicSection = `## ${i + 1}. ${topic.name}\n\n${content}`;
        contents.push(topicSection);

      } catch (err) {
        console.error(`Error generating topic ${topic.name}:`, err);
        await storage.updateTopic(topic.id, { status: "failed" });
        contents.push(`## ${i + 1}. ${topic.name}\n\n*Lỗi tạo nội dung cho phần này.*`);
      }
    }

    // Combine all topic contents into the report with TOC
    const fullContent = `# ${data.title}\n\n${tocSection}${contents.join("\n\n---\n\n")}`;
    await storage.updateOutput(outputId, {
      content: fullContent,
      status: "completed",
      metadata: {
        industry: data.industry,
        company: data.company,
        progress: { current: total, total, currentTopic: "Hoàn thành" },
      },
    });

    console.log(`Report ${outputId} completed`);
  } catch (err) {
    console.error(`Report ${outputId} failed:`, err);
    await storage.updateOutput(outputId, { status: "failed" });
  }
}
