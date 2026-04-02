# BRIEF: Fix Văn bản thuế + RAG với document_chunks

## Vấn đề cần fix

### Fix 1 — Mục "Văn bản thuế" hiển thị trống

`/api/documents` đang query `taxadvice` DB (pool riêng, không có data văn bản).
Cần redirect sang query corpus DB (`postgres`) qua `corpusPool`.

### Fix 2 — AI chưa dùng document_chunks (RAG chưa hoạt động thật)

AI context hiện chỉ lấy `tom_tat` + link từ `searchCorpus()` — bỏ qua 606 chunks đã có embeddings.
Cần bổ sung: sau khi tìm được văn bản liên quan → lấy chunks phù hợp → đưa vào AI context.

---

## Fix 1: `/api/documents` → query corpus DB

### Trong `server/routes.ts`

Thay thế handler `GET /api/documents` (dòng ~117) để query từ `corpusPool` thay vì `storage`:

```typescript
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
```

Tương tự `GET /api/documents/:id` — query từ `corpusPool`:

```typescript
app.get("/api/documents/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const docResult = await corpusPool.query(
      `SELECT * FROM documents WHERE id = $1`, [parseInt(id)]
    );
    if (!docResult.rows[0]) return res.status(404).json({ message: "Không tìm thấy văn bản" });

    // Kèm chunks nếu có
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
```

### Trong `client/src/pages/documents.tsx`

Thêm filter "Anchor only" (checkbox hoặc badge toggle):

```tsx
// Thêm state
const [anchorOnly, setAnchorOnly] = useState(false);

// Thêm vào query URL
if (anchorOnly) url += `anchor_only=true&`;

// Thêm toggle button vào filter bar
<Button
  variant={anchorOnly ? "default" : "outline"}
  size="sm"
  onClick={() => setAnchorOnly(!anchorOnly)}
>
  <Star size={12} className="mr-1" />
  Anchor
</Button>
```

---

## Fix 2: AI dùng document_chunks thật (RAG)

### Trong `server/corpus.ts` — thêm function mới

```typescript
/**
 * Search relevant chunks từ corpus bằng full-text search.
 * Dùng để build RAG context cho AI.
 */
export async function searchCorpusChunks(
  query: string,
  options?: {
    sacThue?: string[];
    limit?: number;         // default 8
    anchorOnly?: boolean;   // default true — chỉ từ anchor docs
  }
): Promise<Array<{
  chunk_id: number;
  doc_id: number;
  so_hieu: string;
  ten: string;
  dieu_so: string | null;
  dieu_ten: string | null;
  header_path: string | null;
  text_content: string;
  link_tvpl: string | null;
  rank: number;
}>> {
  const limit = options?.limit ?? 8;
  const anchorOnly = options?.anchorOnly !== false;

  const params: any[] = [query, limit];
  let docFilter = `d.tinh_trang = 'con_hieu_luc'`;

  if (anchorOnly) {
    docFilter += ` AND d.is_anchor = TRUE`;
  }
  if (options?.sacThue && options.sacThue.length > 0) {
    params.push(options.sacThue);
    docFilter += ` AND d.sac_thue && $${params.length}::varchar[]`;
  }

  const sql = `
    SELECT
      c.id AS chunk_id,
      c.doc_id,
      c.so_hieu,
      d.ten,
      c.dieu_so,
      c.dieu_ten,
      c.header_path,
      c.text_content,
      d.link_tvpl,
      ts_rank(
        to_tsvector('simple', c.text_content),
        plainto_tsquery('simple', $1)
      ) AS rank
    FROM document_chunks c
    JOIN documents d ON d.id = c.doc_id
    WHERE
      to_tsvector('simple', c.text_content) @@ plainto_tsquery('simple', $1)
      AND ${docFilter}
    ORDER BY rank DESC
    LIMIT $2
  `;

  try {
    const result = await corpusPool.query(sql, params);
    return result.rows;
  } catch (err) {
    console.error("Corpus chunks search error:", err);
    return [];
  }
}
```

### Trong `server/routes.ts` — cập nhật AI context (step 2b)

Import thêm `searchCorpusChunks` từ `./corpus`.

Thay thế đoạn "Step 2b" hiện tại:

```typescript
// Step 2b: Corpus RAG — search chunks từ anchor documents
let corpusContext = "";
if (process.env.CORPUS_DATABASE_URL) {
  try {
    // Ưu tiên chunks (RAG thật) từ anchor documents
    const chunks = await searchCorpusChunks(question, {
      sacThue: sac_thue,
      limit: 8,
      anchorOnly: true,
    });

    if (chunks.length > 0) {
      // Build RAG context với citation đầy đủ
      const chunkLines = chunks.map((c, i) => {
        const ref = c.dieu_so
          ? ` — ${c.dieu_so}${c.dieu_ten ? `: ${c.dieu_ten}` : ""}`
          : c.header_path ? ` — ${c.header_path}` : "";
        const link = c.link_tvpl ? `\n   🔗 ${c.link_tvpl}` : "";
        return `[${i+1}] ${c.so_hieu}${ref}\n${c.text_content.slice(0, 800)}${c.text_content.length > 800 ? "..." : ""}${link}`;
      });
      corpusContext = chunkLines.join("\n\n");
    } else {
      // Fallback: document-level search nếu không có chunks match
      const docResults = await searchCorpus(question, {
        importanceMax: 2,
        conHieuLuc: true,
        limit: 5,
        sacThue: sac_thue,
      });
      if (docResults.length > 0) {
        const lines = docResults.map(r => {
          const doc = r.doc as any;
          const tomTat = doc.tom_tat ? `\nTóm tắt: ${doc.tom_tat}` : doc.ket_luan ? `\nKết luận: ${doc.ket_luan}` : "";
          const link = doc.link_tvpl || doc.link_nguon ? `\nLink: ${doc.link_tvpl || doc.link_nguon}` : "";
          return `[${doc.so_hieu}] ${doc.ten}${tomTat}${link}`;
        });
        corpusContext = lines.join("\n\n");
      }
    }
  } catch (err) {
    console.warn("Corpus search failed (non-blocking):", (err as Error).message);
  }
}
```

---

## Checklist

- [ ] `GET /api/documents` → query `corpusPool` (không phải `storage`)
- [ ] `GET /api/documents/:id` → query `corpusPool` + kèm chunks
- [ ] `client/pages/documents.tsx` → thêm filter "Anchor only"
- [ ] `server/corpus.ts` → thêm function `searchCorpusChunks`
- [ ] `server/routes.ts` → AI context dùng `searchCorpusChunks` thay vì chỉ `searchCorpus`
- [ ] Xoá file BRIEF này → commit + push

## Lưu ý

- `corpusPool` đã được import sẵn trong `routes.ts` từ `./corpus`
- Tuyệt đối READ ONLY trên corpus DB — không INSERT/UPDATE/DELETE
- `text_content` trong chunks là plain text (không phải HTML) — dùng trực tiếp được
- Chunk size ~500-1500 ký tự — cắt ở 800 chars khi đưa vào AI context để tiết kiệm tokens
