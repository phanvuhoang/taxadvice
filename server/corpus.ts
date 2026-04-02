import pg from "pg";

const { Pool } = pg;

// Corpus connection pool — READ ONLY, connects to dbvntax corpus
export const corpusPool = new Pool({
  connectionString: process.env.CORPUS_DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

corpusPool.on("error", (err) => {
  console.error("Corpus PostgreSQL error:", err);
});

// ---- Interfaces ----

export interface CorpusDocument {
  id: number;
  so_hieu: string;
  ten: string;
  loai: string;
  co_quan: string;
  ngay_ban_hanh: Date | null;
  hieu_luc_tu: Date | null;
  het_hieu_luc_tu: Date | null;
  tinh_trang: string;
  sac_thue: string[];
  chu_de: string[];
  noi_dung: string | null;
  tom_tat: string | null;
  link_tvpl: string | null;
  importance: number;
  is_anchor: boolean;
  anchor_from: Date | null;
  anchor_to: Date | null;
  keywords: string[];
}

export interface CorpusCV {
  id: number;
  so_hieu: string;
  ten: string;
  co_quan: string;
  nguoi_nhan: string | null;
  ngay_ban_hanh: Date | null;
  sac_thue: string[];
  chu_de: string[];
  van_ban_trich_dan: any;
  ket_luan: string | null;
  noi_dung_day_du: string | null;
  nguon: string;
  link_nguon: string | null;
  importance: number;
}

export interface CorpusChunk {
  id: number;
  doc_id: number;
  so_hieu: string;
  chunk_index: number;
  dieu_so: string | null;
  dieu_ten: string | null;
  khoan_so: string | null;
  chunk_level: string;
  header_path: string | null;
  text_content: string;
  char_count: number;
}

export interface CorpusSearchResult {
  type: "vanban" | "congvan";
  doc: CorpusDocument | CorpusCV;
  relevanceScore?: number;
}

// ---- Helper: strip HTML tags ----
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

// ---- Query Functions ----

export async function searchCorpus(
  query: string,
  options?: {
    sacThue?: string[];
    loai?: string[];
    limit?: number;
    importanceMax?: number;
    anchorOnly?: boolean;
    conHieuLuc?: boolean;
  }
): Promise<CorpusSearchResult[]> {
  const limit = options?.limit ?? 10;
  const importanceMax = options?.importanceMax ?? 3;
  const conHieuLuc = options?.conHieuLuc !== false;

  const results: CorpusSearchResult[] = [];

  // Search documents
  const docParams: any[] = [query, importanceMax, Math.ceil(limit * 0.7)];
  let docWhere = `to_tsvector('simple', coalesce(ten,'') || ' ' || coalesce(noi_dung,'')) @@ plainto_tsquery('simple', $1)
    AND importance <= $2`;

  if (conHieuLuc) {
    docWhere += ` AND tinh_trang = 'con_hieu_luc'`;
  }
  if (options?.anchorOnly) {
    docWhere += ` AND is_anchor = TRUE`;
  }
  if (options?.sacThue && options.sacThue.length > 0) {
    docWhere += ` AND sac_thue && $${docParams.length + 1}::varchar[]`;
    docParams.push(options.sacThue);
  }
  if (options?.loai && options.loai.length > 0) {
    docWhere += ` AND loai = ANY($${docParams.length + 1}::varchar[])`;
    docParams.push(options.loai);
  }

  const docSQL = `
    SELECT id, so_hieu, ten, loai, co_quan, ngay_ban_hanh, hieu_luc_tu, het_hieu_luc_tu,
           tinh_trang, sac_thue, chu_de, tom_tat, link_tvpl, importance, is_anchor,
           anchor_from, anchor_to, keywords,
           ts_rank(to_tsvector('simple', coalesce(ten,'') || ' ' || coalesce(noi_dung,'')),
                   plainto_tsquery('simple', $1)) AS rank
    FROM documents
    WHERE ${docWhere}
    ORDER BY rank DESC, importance ASC, ngay_ban_hanh DESC
    LIMIT $3
  `;

  try {
    const docRows = await corpusPool.query(docSQL, docParams);
    for (const row of docRows.rows) {
      results.push({
        type: "vanban",
        doc: row as CorpusDocument,
        relevanceScore: parseFloat(row.rank),
      });
    }
  } catch (err) {
    console.error("Corpus documents search error:", err);
  }

  // Search cong_van
  const cvLimit = limit - results.length;
  if (cvLimit > 0) {
    const cvParams: any[] = [query, cvLimit];
    let cvWhere = `to_tsvector('simple', coalesce(ten,'') || ' ' || coalesce(noi_dung_day_du,'')) @@ plainto_tsquery('simple', $1)`;

    if (options?.sacThue && options.sacThue.length > 0) {
      cvWhere += ` AND sac_thue && $${cvParams.length + 1}::varchar[]`;
      cvParams.push(options.sacThue);
    }

    const cvSQL = `
      SELECT id, so_hieu, ten, co_quan, nguoi_nhan, ngay_ban_hanh, sac_thue, chu_de,
             van_ban_trich_dan, ket_luan, nguon, link_nguon, importance,
             ts_rank(to_tsvector('simple', coalesce(ten,'') || ' ' || coalesce(noi_dung_day_du,'')),
                     plainto_tsquery('simple', $1)) AS rank
      FROM cong_van
      WHERE ${cvWhere}
      ORDER BY rank DESC, ngay_ban_hanh DESC
      LIMIT $2
    `;

    try {
      const cvRows = await corpusPool.query(cvSQL, cvParams);
      for (const row of cvRows.rows) {
        results.push({
          type: "congvan",
          doc: row as CorpusCV,
          relevanceScore: parseFloat(row.rank),
        });
      }
    } catch (err) {
      console.error("Corpus cong_van search error:", err);
    }
  }

  return results;
}

export async function getDocumentBySoHieu(soHieu: string): Promise<CorpusDocument | null> {
  const sql = `
    SELECT id, so_hieu, ten, loai, co_quan, ngay_ban_hanh, hieu_luc_tu, het_hieu_luc_tu,
           tinh_trang, sac_thue, chu_de, noi_dung, tom_tat, link_tvpl, importance,
           is_anchor, anchor_from, anchor_to, keywords
    FROM documents
    WHERE so_hieu = $1
    LIMIT 1
  `;
  const result = await corpusPool.query(sql, [soHieu]);
  return result.rows[0] || null;
}

export async function getDocumentChunks(
  docId: number,
  options?: { dieuSo?: string; limit?: number }
): Promise<CorpusChunk[]> {
  const params: any[] = [docId];
  let where = `doc_id = $1`;

  if (options?.dieuSo) {
    where += ` AND dieu_so = $${params.length + 1}`;
    params.push(options.dieuSo);
  }

  const limit = options?.limit ?? 50;
  params.push(limit);

  const sql = `
    SELECT id, doc_id, so_hieu, chunk_index, dieu_so, dieu_ten, khoan_so,
           chunk_level, header_path, text_content, char_count
    FROM document_chunks
    WHERE ${where}
    ORDER BY chunk_index ASC
    LIMIT $${params.length}
  `;

  const result = await corpusPool.query(sql, params);
  return result.rows as CorpusChunk[];
}

export async function getAnchorDocuments(sacThue?: string[]): Promise<CorpusDocument[]> {
  const params: any[] = [];
  let where = `is_anchor = TRUE AND tinh_trang = 'con_hieu_luc'`;

  if (sacThue && sacThue.length > 0) {
    params.push(sacThue);
    where += ` AND sac_thue && $1::varchar[]`;
  }

  const sql = `
    SELECT id, so_hieu, ten, loai, co_quan, ngay_ban_hanh, hieu_luc_tu, het_hieu_luc_tu,
           tinh_trang, sac_thue, chu_de, tom_tat, link_tvpl, importance,
           is_anchor, anchor_from, anchor_to, keywords
    FROM documents
    WHERE ${where}
    ORDER BY importance ASC, ngay_ban_hanh DESC
  `;

  const result = await corpusPool.query(sql, params);
  return result.rows as CorpusDocument[];
}
