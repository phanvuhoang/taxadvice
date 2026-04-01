import pool from "./db";
import type {
  AppUser, AppUserPublic, Document, DocumentSummary, DocumentChunk,
  Output, ReportTopic, PasswordReset, Citation
} from "@shared/schema";
import bcrypt from "bcryptjs";

// ---- User operations ----

export async function createUser(email: string, password: string, name: string, role = "user"): Promise<AppUserPublic> {
  const hash = await bcrypt.hash(password, 12);
  const result = await pool.query(
    `INSERT INTO app_users (email, password_hash, name, role) VALUES ($1, $2, $3, $4)
     RETURNING id, email, name, role, created_at`,
    [email, hash, name, role]
  );
  return result.rows[0];
}

export async function getUserByEmail(email: string): Promise<AppUser | null> {
  const result = await pool.query(`SELECT * FROM app_users WHERE email = $1`, [email]);
  return result.rows[0] || null;
}

export async function getUserById(id: number): Promise<AppUserPublic | null> {
  const result = await pool.query(
    `SELECT id, email, name, role, created_at FROM app_users WHERE id = $1`, [id]
  );
  return result.rows[0] || null;
}

export async function getAllUsers(): Promise<AppUserPublic[]> {
  const result = await pool.query(
    `SELECT id, email, name, role, created_at FROM app_users ORDER BY created_at DESC`
  );
  return result.rows;
}

export async function updateUserRole(id: number, role: string): Promise<void> {
  await pool.query(`UPDATE app_users SET role = $1, updated_at = NOW() WHERE id = $2`, [role, id]);
}

export async function deleteUser(id: number): Promise<void> {
  await pool.query(`DELETE FROM app_users WHERE id = $1`, [id]);
}

export async function verifyPassword(user: AppUser, password: string): Promise<boolean> {
  return bcrypt.compare(password, user.password_hash);
}

export async function updatePassword(userId: number, newPassword: string): Promise<void> {
  const hash = await bcrypt.hash(newPassword, 12);
  await pool.query(`UPDATE app_users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [hash, userId]);
}

// ---- Password Reset ----

export async function createPasswordReset(userId: number, token: string): Promise<void> {
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await pool.query(
    `INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)`,
    [userId, token, expiresAt]
  );
}

export async function getPasswordReset(token: string): Promise<PasswordReset | null> {
  const result = await pool.query(
    `SELECT * FROM password_resets WHERE token = $1 AND used = FALSE AND expires_at > NOW()`,
    [token]
  );
  return result.rows[0] || null;
}

export async function markResetUsed(token: string): Promise<void> {
  await pool.query(`UPDATE password_resets SET used = TRUE WHERE token = $1`, [token]);
}

// ---- Documents (read-only from existing table) ----

export async function getDocuments(filters?: {
  sac_thue?: string;
  loai?: string;
  tinh_trang?: string;
  search?: string;
}): Promise<DocumentSummary[]> {
  let query = `SELECT id, so_hieu, ten, loai, co_quan, ngay_ban_hanh, hieu_luc_tu,
    het_hieu_luc_tu, tinh_trang, sac_thue, importance, is_anchor
    FROM documents WHERE 1=1`;
  const params: any[] = [];
  let idx = 1;

  if (filters?.sac_thue) {
    query += ` AND $${idx} = ANY(sac_thue)`;
    params.push(filters.sac_thue);
    idx++;
  }
  if (filters?.loai) {
    query += ` AND loai = $${idx}`;
    params.push(filters.loai);
    idx++;
  }
  if (filters?.tinh_trang) {
    query += ` AND tinh_trang = $${idx}`;
    params.push(filters.tinh_trang);
    idx++;
  }
  if (filters?.search) {
    query += ` AND (ten ILIKE $${idx} OR so_hieu ILIKE $${idx} OR tom_tat ILIKE $${idx})`;
    params.push(`%${filters.search}%`);
    idx++;
  }

  query += ` ORDER BY importance ASC, ngay_ban_hanh DESC`;
  const result = await pool.query(query, params);
  return result.rows;
}

export async function getDocumentById(id: number): Promise<Document | null> {
  const result = await pool.query(`SELECT * FROM documents WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

// ---- Document Chunks ----

export async function getChunksByDocumentId(documentId: number): Promise<DocumentChunk[]> {
  const result = await pool.query(
    `SELECT id, document_id, chunk_text, chunk_index, article_ref, section_path, created_at
     FROM document_chunks WHERE document_id = $1 ORDER BY chunk_index`,
    [documentId]
  );
  return result.rows;
}

export async function insertChunk(chunk: {
  document_id: number;
  chunk_text: string;
  chunk_index: number;
  article_ref: string | null;
  section_path: string | null;
}): Promise<number> {
  const result = await pool.query(
    `INSERT INTO document_chunks (document_id, chunk_text, chunk_index, article_ref, section_path, tsvector_content)
     VALUES ($1, $2, $3, $4, $5, to_tsvector('simple', $2))
     RETURNING id`,
    [chunk.document_id, chunk.chunk_text, chunk.chunk_index, chunk.article_ref, chunk.section_path]
  );
  return result.rows[0].id;
}

export async function updateChunkEmbedding(chunkId: number, embedding: number[]): Promise<void> {
  await pool.query(
    `UPDATE document_chunks SET embedding = $1::vector WHERE id = $2`,
    [`[${embedding.join(",")}]`, chunkId]
  );
}

export async function deleteChunksByDocumentId(documentId: number): Promise<void> {
  await pool.query(`DELETE FROM document_chunks WHERE document_id = $1`, [documentId]);
}

export async function getChunkCount(): Promise<number> {
  const result = await pool.query(`SELECT COUNT(*) as count FROM document_chunks`);
  return parseInt(result.rows[0].count);
}

// ---- Hybrid Search ----

export async function hybridSearch(query: string, queryEmbedding: number[], options?: {
  sac_thue?: string[];
  limit?: number;
}): Promise<Array<DocumentChunk & { document_so_hieu: string; document_ten: string; score: number }>> {
  const limit = options?.limit || 15;

  // Build sac_thue filter
  let sacThueFilter = "";
  const params: any[] = [query, `[${queryEmbedding.join(",")}]`, limit];
  let paramIdx = 4;

  if (options?.sac_thue && options.sac_thue.length > 0) {
    sacThueFilter = `AND d.sac_thue && $${paramIdx}::varchar[]`;
    params.push(`{${options.sac_thue.join(",")}}`);
    paramIdx++;
  }

  // Hybrid search: combine full-text rank + vector cosine similarity using RRF
  const result = await pool.query(
    `WITH fts AS (
      SELECT dc.id, dc.document_id, dc.chunk_text, dc.chunk_index, dc.article_ref, dc.section_path,
        ts_rank_cd(dc.tsvector_content, plainto_tsquery('simple', $1)) as fts_rank,
        ROW_NUMBER() OVER (ORDER BY ts_rank_cd(dc.tsvector_content, plainto_tsquery('simple', $1)) DESC) as fts_rn
      FROM document_chunks dc
      JOIN documents d ON d.id = dc.document_id
      WHERE dc.tsvector_content @@ plainto_tsquery('simple', $1)
        ${sacThueFilter}
      ORDER BY fts_rank DESC
      LIMIT 60
    ),
    sem AS (
      SELECT dc.id, dc.document_id, dc.chunk_text, dc.chunk_index, dc.article_ref, dc.section_path,
        1 - (dc.embedding <=> $2::vector) as cosine_sim,
        ROW_NUMBER() OVER (ORDER BY dc.embedding <=> $2::vector) as sem_rn
      FROM document_chunks dc
      JOIN documents d ON d.id = dc.document_id
      WHERE dc.embedding IS NOT NULL
        ${sacThueFilter}
      ORDER BY dc.embedding <=> $2::vector
      LIMIT 60
    ),
    combined AS (
      SELECT 
        COALESCE(f.id, s.id) as id,
        COALESCE(f.document_id, s.document_id) as document_id,
        COALESCE(f.chunk_text, s.chunk_text) as chunk_text,
        COALESCE(f.chunk_index, s.chunk_index) as chunk_index,
        COALESCE(f.article_ref, s.article_ref) as article_ref,
        COALESCE(f.section_path, s.section_path) as section_path,
        -- RRF score: 1/(k+rank), k=60
        COALESCE(1.0 / (60 + f.fts_rn), 0) + COALESCE(1.0 / (60 + s.sem_rn), 0) as rrf_score
      FROM fts f
      FULL OUTER JOIN sem s ON f.id = s.id
    )
    SELECT c.*, d.so_hieu as document_so_hieu, d.ten as document_ten, c.rrf_score as score
    FROM combined c
    JOIN documents d ON d.id = c.document_id
    ORDER BY c.rrf_score DESC
    LIMIT $3`,
    params
  );

  return result.rows;
}

// Fallback: document-level semantic search (using existing document embeddings)
export async function documentSemanticSearch(queryEmbedding: number[], options?: {
  sac_thue?: string[];
  limit?: number;
}): Promise<DocumentSummary[]> {
  const limit = options?.limit || 10;
  let query = `SELECT id, so_hieu, ten, loai, co_quan, ngay_ban_hanh, hieu_luc_tu,
    het_hieu_luc_tu, tinh_trang, sac_thue, importance, is_anchor,
    1 - (embedding <=> $1::vector) as similarity
    FROM documents WHERE embedding IS NOT NULL`;
  const params: any[] = [`[${queryEmbedding.join(",")}]`];
  let idx = 2;

  if (options?.sac_thue && options.sac_thue.length > 0) {
    query += ` AND sac_thue && $${idx}::varchar[]`;
    params.push(`{${options.sac_thue.join(",")}}`);
    idx++;
  }

  query += ` ORDER BY embedding <=> $1::vector LIMIT $${idx}`;
  params.push(limit);

  const result = await pool.query(query, params);
  return result.rows;
}

// ---- Outputs ----

export async function createOutput(data: {
  user_id: number;
  type: string;
  title: string;
  question?: string;
  content?: string;
  citations?: Citation[];
  status?: string;
  ai_model?: string;
  metadata?: any;
}): Promise<Output> {
  const result = await pool.query(
    `INSERT INTO outputs (user_id, type, title, question, content, citations, status, ai_model, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      data.user_id, data.type, data.title, data.question || null,
      data.content || null, JSON.stringify(data.citations || []),
      data.status || "completed", data.ai_model || null,
      JSON.stringify(data.metadata || {})
    ]
  );
  return result.rows[0];
}

export async function updateOutput(id: number, data: Partial<{
  title: string;
  content: string;
  citations: Citation[];
  status: string;
  metadata: any;
}>): Promise<Output> {
  const sets: string[] = ["updated_at = NOW()"];
  const params: any[] = [];
  let idx = 1;

  if (data.title !== undefined) { sets.push(`title = $${idx}`); params.push(data.title); idx++; }
  if (data.content !== undefined) { sets.push(`content = $${idx}`); params.push(data.content); idx++; }
  if (data.citations !== undefined) { sets.push(`citations = $${idx}`); params.push(JSON.stringify(data.citations)); idx++; }
  if (data.status !== undefined) { sets.push(`status = $${idx}`); params.push(data.status); idx++; }
  if (data.metadata !== undefined) { sets.push(`metadata = $${idx}`); params.push(JSON.stringify(data.metadata)); idx++; }

  params.push(id);
  const result = await pool.query(
    `UPDATE outputs SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
    params
  );
  return result.rows[0];
}

export async function getOutputById(id: number): Promise<Output | null> {
  const result = await pool.query(`SELECT * FROM outputs WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

export async function getOutputsByUserId(userId: number, options?: {
  type?: string;
  limit?: number;
  offset?: number;
}): Promise<{ outputs: Output[]; total: number }> {
  const limit = options?.limit || 20;
  const offset = options?.offset || 0;

  let whereClause = `WHERE user_id = $1`;
  const params: any[] = [userId];
  let idx = 2;

  if (options?.type) {
    whereClause += ` AND type = $${idx}`;
    params.push(options.type);
    idx++;
  }

  const countResult = await pool.query(
    `SELECT COUNT(*) as total FROM outputs ${whereClause}`, params
  );
  
  params.push(limit, offset);
  const result = await pool.query(
    `SELECT * FROM outputs ${whereClause} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
    params
  );

  return {
    outputs: result.rows,
    total: parseInt(countResult.rows[0].total),
  };
}

export async function deleteOutput(id: number, userId: number): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM outputs WHERE id = $1 AND user_id = $2`, [id, userId]
  );
  return (result.rowCount || 0) > 0;
}

// ---- Report Topics ----

export async function getTopicsByOutputId(outputId: number): Promise<ReportTopic[]> {
  const result = await pool.query(
    `SELECT * FROM report_topics WHERE output_id = $1 ORDER BY sort_order, id`,
    [outputId]
  );
  return result.rows;
}

export async function createTopic(data: {
  output_id: number;
  name: string;
  parent_id?: number | null;
  sort_order?: number;
}): Promise<ReportTopic> {
  const result = await pool.query(
    `INSERT INTO report_topics (output_id, name, parent_id, sort_order)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [data.output_id, data.name, data.parent_id || null, data.sort_order || 0]
  );
  return result.rows[0];
}

export async function updateTopic(id: number, data: Partial<{
  name: string;
  parent_id: number | null;
  sort_order: number;
  content: string;
  status: string;
}>): Promise<ReportTopic> {
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (data.name !== undefined) { sets.push(`name = $${idx}`); params.push(data.name); idx++; }
  if (data.parent_id !== undefined) { sets.push(`parent_id = $${idx}`); params.push(data.parent_id); idx++; }
  if (data.sort_order !== undefined) { sets.push(`sort_order = $${idx}`); params.push(data.sort_order); idx++; }
  if (data.content !== undefined) { sets.push(`content = $${idx}`); params.push(data.content); idx++; }
  if (data.status !== undefined) { sets.push(`status = $${idx}`); params.push(data.status); idx++; }

  params.push(id);
  const result = await pool.query(
    `UPDATE report_topics SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
    params
  );
  return result.rows[0];
}

export async function deleteTopic(id: number): Promise<void> {
  await pool.query(`DELETE FROM report_topics WHERE id = $1`, [id]);
}
