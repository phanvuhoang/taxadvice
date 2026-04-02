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
  getTaxAdvicePrompt, getReportTopicPrompt,
  searchWithPerplexity,
} from "./ai";
import { processDocument, processAllDocuments } from "./chunker";
import { generatePDF } from "./pdf";
import {
  registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema,
  quickQASchema, scenarioSchema, articleSchema, reportSchema, topicSchema, taxAdviceSchema,
} from "@shared/schema";

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
      const docs = await storage.getDocuments({
        sac_thue: String(req.query.sac_thue || ""),
        loai: String(req.query.loai || ""),
        tinh_trang: String(req.query.tinh_trang || ""),
        search: String(req.query.search || ""),
      });
      res.json(docs);
    } catch (err) {
      res.status(400).json({ message: "Lỗi tải danh sách văn bản" });
    }
  });

  app.get("/api/documents/:id", requireAuth, async (req, res) => {
    try {
      const doc = await storage.getDocumentById(parseInt(String(req.params.id)));
      if (!doc) return res.status(404).json({ message: "Không tìm thấy văn bản" });
      res.json(doc);
    } catch (err) {
      res.status(400).json({ message: "Lỗi tải văn bản" });
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

  app.get("/api/outputs/:id/export/pdf", requireAuth, async (req, res) => {
    try {
      const output = await storage.getOutputById(parseInt(String(req.params.id)));
      if (!output) return res.status(404).json({ message: "Không tìm thấy" });

      const pdfBuffer = await generatePDF(output);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="taxadvice-${output.id}.pdf"`);
      res.send(pdfBuffer);
    } catch (err) {
      console.error("PDF export error:", err);
      res.status(400).json({ message: "Lỗi xuất PDF" });
    }
  });

  // ========== AI ROUTES ==========

  // Helper: search + generate
  async function searchAndGenerate(options: {
    question: string;
    sac_thue?: string[];
    ai_model: "deepseek" | "anthropic";
    promptBuilder: (context: string, internetContext?: string) => string;
    type: string;
    title: string;
    userId: number;
    res: any;
  }) {
    const { question, sac_thue, ai_model, promptBuilder, type, title, userId, res: response } = options;

    try {
      // Step 1: Generate embedding for the question
      let queryEmbedding: number[];
      try {
        queryEmbedding = await generateEmbedding(question);
      } catch {
        // Fallback: use zero vector if embedding fails
        queryEmbedding = new Array(1536).fill(0);
      }

      // Step 2: Hybrid search for relevant chunks from database
      const chunkCount = await storage.getChunkCount();
      let chunks: any[] = [];
      let contextText: string;
      let dbHasResults = false;

      if (chunkCount > 0) {
        chunks = await storage.hybridSearch(question, queryEmbedding, {
          sac_thue,
          limit: 12,
        });
        contextText = buildContextFromChunks(chunks);
        dbHasResults = chunks.length > 0;
      } else {
        // Fallback to document-level search if no chunks exist
        const docs = await storage.documentSemanticSearch(queryEmbedding, { sac_thue, limit: 5 });
        dbHasResults = docs.length > 0;
        contextText = dbHasResults
          ? docs.map(d => `--- ${d.so_hieu}: ${d.ten} ---`).join("\n")
          : "Không tìm thấy quy định phù hợp trong cơ sở dữ liệu.";
      }

      // Step 2b: Perplexity internet research (fallback or supplement)
      // - If DB has few results (< 3 chunks), also search internet for supplementary info
      // - If DB has no results, internet search becomes primary research source
      let internetContext: string | undefined;
      let perplexityCitations: string[] = [];

      if (process.env.PERPLEXITY_API_KEY) {
        const shouldSearchInternet = !dbHasResults || chunks.length < 3;
        if (shouldSearchInternet) {
          try {
            console.log(`[Perplexity] Searching internet for: ${question.slice(0, 80)}...`);
            const pplxResult = await searchWithPerplexity(question);
            if (pplxResult && pplxResult.answer) {
              internetContext = pplxResult.answer;
              perplexityCitations = pplxResult.citations || [];
              console.log(`[Perplexity] Found ${perplexityCitations.length} citations`);
            }
          } catch (err) {
            console.warn("Perplexity search failed (non-blocking):", (err as Error).message);
          }
        }
      }

      // Step 3: Build prompt with both DB context and internet context
      const systemPrompt = promptBuilder(contextText, internetContext);

      // Set up SSE for streaming
      response.setHeader("Content-Type", "text/event-stream");
      response.setHeader("Cache-Control", "no-cache");
      response.setHeader("Connection", "keep-alive");

      // Send source info to frontend
      const sources: string[] = [];
      if (dbHasResults) sources.push("database");
      if (internetContext) sources.push("internet");
      response.write(`data: ${JSON.stringify({ type: "sources", sources })}\n\n`);

      let fullContent = "";

      const content = await streamLLM({
        model: ai_model,
        systemPrompt,
        userMessage: question,
        onChunk: (text) => {
          fullContent += text;
          response.write(`data: ${JSON.stringify({ type: "chunk", text })}\n\n`);
        },
      });

      // Step 4: Save output with citations from both sources
      const dbCitations = buildCitationsFromChunks(chunks);
      // Add Perplexity web citations as a special citation type
      const webCitations = perplexityCitations.map((url, i) => ({
        document_id: 0,
        so_hieu: `Web ${i + 1}`,
        article_ref: url,
        excerpt: "(Nguồn: internet - cần kiểm chứng)",
      }));
      const allCitations = [...dbCitations, ...webCitations];

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
          db_chunks_found: chunks.length,
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
      });
    } catch (err: any) {
      if (err.name === "ZodError") return res.status(400).json({ message: err.errors[0]?.message });
      res.status(400).json({ message: err.message });
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
        metadata: { industry: data.industry, company: data.company },
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

      // Search for relevant content
      let queryEmbedding: number[];
      try {
        queryEmbedding = await generateEmbedding(topic.name);
      } catch {
        queryEmbedding = new Array(1536).fill(0);
      }

      const chunkCount = await storage.getChunkCount();
      let contextText: string;

      if (chunkCount > 0) {
        const chunks = await storage.hybridSearch(topic.name, queryEmbedding, { limit: 10 });
        contextText = buildContextFromChunks(chunks);
      } else {
        contextText = "Không tìm thấy quy định cụ thể.";
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
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      db: dbStatus,
      admin_email: adminEmail,
      admin_exists: adminExists,
      env_check: {
        DATABASE_URL: !!process.env.DATABASE_URL,
        JWT_SECRET: !!process.env.JWT_SECRET,
        DEEPSEEK_API_KEY: !!process.env.DEEPSEEK_API_KEY,
        ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
        OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
        PERPLEXITY_API_KEY: !!process.env.PERPLEXITY_API_KEY,
        SMTP_HOST: !!process.env.SMTP_HOST,
      },
    });
  });

  return httpServer;
}

// Background report processing
async function processReportInBackground(outputId: number, data: any) {
  try {
    const topics = await storage.getTopicsByOutputId(outputId);

    if (topics.length === 0) {
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
    }

    // Generate content for each topic
    const allTopics = await storage.getTopicsByOutputId(outputId);
    const contents: string[] = [];

    for (const topic of allTopics) {
      try {
        await storage.updateTopic(topic.id, { status: "processing" });

        let queryEmbedding: number[];
        try {
          queryEmbedding = await generateEmbedding(`${data.title} - ${topic.name}`);
        } catch {
          queryEmbedding = new Array(1536).fill(0);
        }

        const chunkCount = await storage.getChunkCount();
        let contextText: string;
        if (chunkCount > 0) {
          const chunks = await storage.hybridSearch(topic.name, queryEmbedding, { limit: 10 });
          contextText = buildContextFromChunks(chunks);
        } else {
          contextText = "Không tìm thấy quy định cụ thể.";
        }

        const systemPrompt = getReportTopicPrompt(contextText, topic.name, data.title);
        const content = await callLLM({
          model: data.ai_model || "deepseek",
          systemPrompt,
          userMessage: `Viết phần phân tích cho: ${topic.name}${data.industry ? ` (Ngành: ${data.industry})` : ""}${data.company ? ` (Công ty: ${data.company})` : ""}`,
        });

        await storage.updateTopic(topic.id, { content, status: "completed" });
        contents.push(`## ${topic.name}\n\n${content}`);
      } catch (err) {
        console.error(`Error generating topic ${topic.name}:`, err);
        await storage.updateTopic(topic.id, { status: "failed" });
      }
    }

    // Combine all topic contents into the report
    const fullContent = `# ${data.title}\n\n${contents.join("\n\n---\n\n")}`;
    await storage.updateOutput(outputId, {
      content: fullContent,
      status: "completed",
    });

    console.log(`Report ${outputId} completed`);
  } catch (err) {
    console.error(`Report ${outputId} failed:`, err);
    await storage.updateOutput(outputId, { status: "failed" });
  }
}
