# BRIEF: Corpus Integration — Kết nối dbvntax vào taxadvice

## Mục tiêu

Taxadvice cần query được văn bản pháp luật + công văn từ dbvntax corpus (PostgreSQL riêng) để:
1. Tìm kiếm full-text văn bản liên quan khi AI trả lời
2. Hiển thị danh sách văn bản tham chiếu kèm citation
3. Filter theo sắc thuế, loại văn bản, importance level

---

## Database Setup

Có **2 connection pools** riêng biệt:

```typescript
// Pool 1 — taxadvice app data (app_users, outputs, report_topics, v.v.)
DATABASE_URL=postgresql://taxadvice_user:TaxAdvice2026!@10.0.1.11:5432/taxadvice

// Pool 2 — dbvntax corpus (READ ONLY)
CORPUS_DATABASE_URL=postgresql://taxadvice_user:TaxAdvice2026!@10.0.1.11:5432/postgres
```

`taxadvice_user` đã được GRANT SELECT trên các tables corpus.

---

## Schema Corpus (database `postgres`, READ ONLY)

### Table `documents` — Văn bản pháp luật

| Column | Type | Mô tả |
|--------|------|-------|
| `id` | integer | PK |
| `so_hieu` | varchar(200) | Số hiệu VB, VD: "108/2025/QH15" |
| `ten` | text | Tên đầy đủ |
| `loai` | varchar(20) | Loại: `Luat`, `ND` (Nghị định), `TT` (Thông tư), `VBHN`, `NQ`, `QD`, `Khac` |
| `co_quan` | varchar(100) | Cơ quan ban hành |
| `ngay_ban_hanh` | date | Ngày ký ban hành |
| `hieu_luc_tu` | date | Ngày có hiệu lực |
| `het_hieu_luc_tu` | date | Ngày hết hiệu lực (NULL = còn hiệu lực) |
| `tinh_trang` | varchar(20) | `con_hieu_luc` \| `het_hieu_luc` \| `chua_hieu_luc` |
| `sac_thue` | varchar(30)[] | Array sắc thuế, VD: `{CIT, VAT}` |
| `chu_de` | varchar(50)[] | Array chủ đề |
| `noi_dung` | text | Nội dung đầy đủ HTML |
| `tom_tat` | text | Tóm tắt ngắn |
| `link_tvpl` | text | Link thuvienphapluat.vn |
| `importance` | smallint | 1=quan trọng nhất (Luật/NĐ/TT), 2=VBHN/NQ, 3=QĐ/Khác |
| `is_anchor` | boolean | TRUE = văn bản chủ chốt (anchor document) |
| `anchor_from` | date | Ngày bắt đầu anchor |
| `anchor_to` | date | Ngày kết thúc anchor (NULL = hiện tại) |
| `keywords` | text[] | Từ khóa |
| `embedding` | vector(1536) | OpenAI embedding (có thể NULL) |

### Table `cong_van` — Công văn hướng dẫn

| Column | Type | Mô tả |
|--------|------|-------|
| `id` | integer | PK |
| `so_hieu` | varchar(200) | Số hiệu CV |
| `ten` | text | Tên/trích yếu |
| `co_quan` | varchar(100) | Cơ quan ban hành |
| `nguoi_nhan` | text | Đối tượng nhận |
| `ngay_ban_hanh` | date | Ngày ban hành |
| `sac_thue` | varchar(30)[] | Array sắc thuế |
| `chu_de` | text[] | Array chủ đề |
| `van_ban_trich_dan` | jsonb | Văn bản được trích dẫn |
| `ket_luan` | text | Kết luận/quan điểm chính |
| `noi_dung_day_du` | text | Nội dung đầy đủ |
| `nguon` | varchar(50) | Nguồn: `corpus`, `gdt` |
| `link_nguon` | text | Link gốc |
| `importance` | smallint | 4 (mặc định) |
| `embedding` | vector(1536) | OpenAI embedding (có thể NULL) |

### Table `document_chunks` — Chunks văn bản (cho RAG)

| Column | Type | Mô tả |
|--------|------|-------|
| `id` | integer | PK |
| `doc_id` | integer | FK → documents.id |
| `so_hieu` | varchar(200) | Số hiệu VB (denormalized) |
| `chunk_index` | integer | Thứ tự chunk |
| `dieu_so` | varchar(20) | Số điều, VD: "Điều 5" |
| `dieu_ten` | text | Tên điều |
| `khoan_so` | varchar(20) | Số khoản |
| `chunk_level` | varchar(20) | `dieu` \| `khoan` \| `diem` |
| `header_path` | text | Path đầy đủ, VD: "Chương II > Điều 5 > Khoản 1" |
| `text_content` | text | Nội dung chunk |
| `char_count` | integer | Số ký tự |
| `embedding` | vector(1536) | Embedding chunk (có thể NULL) |

---

## Yêu cầu Implementation

### 1. Tạo file `server/corpus.ts` — Corpus Pool & Query Functions

```typescript
// Corpus connection pool (READ ONLY)
export const corpusPool = new Pool({
  connectionString: process.env.CORPUS_DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
});

// Interfaces
export interface CorpusDocument { ... }  // map từ documents table
export interface CorpusCV { ... }         // map từ cong_van table
export interface CorpusChunk { ... }      // map từ document_chunks table
export interface CorpusSearchResult {
  type: 'vanban' | 'congvan';
  doc: CorpusDocument | CorpusCV;
  relevanceScore?: number;
}
```

**Functions cần implement:**

```typescript
// Full-text search cả documents + cong_van
export async function searchCorpus(
  query: string,
  options?: {
    sacThue?: string[];       // filter sắc thuế
    loai?: string[];          // filter loại VB (Luat, ND, TT...)
    limit?: number;           // default 10
    importanceMax?: number;   // chỉ lấy importance <= N (1=chỉ Luật/NĐ/TT)
    anchorOnly?: boolean;     // chỉ lấy anchor documents
    conHieuLuc?: boolean;     // default true — chỉ lấy còn hiệu lực
  }
): Promise<CorpusSearchResult[]>

// Lấy document theo so_hieu
export async function getDocumentBySoHieu(soHieu: string): Promise<CorpusDocument | null>

// Lấy chunks của một document (cho RAG context)
export async function getDocumentChunks(
  docId: number,
  options?: { dieuSo?: string; limit?: number }
): Promise<CorpusChunk[]>

// Lấy anchor documents theo sắc thuế
export async function getAnchorDocuments(sacThue?: string[]): Promise<CorpusDocument[]>
```

**Query gợi ý cho `searchCorpus` (full-text):**

```sql
-- Search documents
SELECT id, so_hieu, ten, loai, ngay_ban_hanh, tinh_trang, sac_thue, tom_tat, link_tvpl, importance, is_anchor,
  ts_rank(to_tsvector('simple', coalesce(ten,'') || ' ' || coalesce(noi_dung,'')),
          plainto_tsquery('simple', $1)) AS rank
FROM documents
WHERE to_tsvector('simple', coalesce(ten,'') || ' ' || coalesce(noi_dung,'')) @@ plainto_tsquery('simple', $1)
  AND tinh_trang = 'con_hieu_luc'
  AND importance <= $2
ORDER BY rank DESC, importance ASC, ngay_ban_hanh DESC
LIMIT $3

-- Search cong_van (tương tự, dùng idx_cv_fts)
SELECT id, so_hieu, ten, co_quan, ngay_ban_hanh, sac_thue, ket_luan, link_nguon, importance
FROM cong_van
WHERE to_tsvector('simple', coalesce(ten,'') || ' ' || coalesce(noi_dung_day_du,'')) @@ plainto_tsquery('simple', $1)
ORDER BY ngay_ban_hanh DESC
LIMIT $3
```

---

### 2. Cập nhật `server/db.ts`

Thêm env var `CORPUS_DATABASE_URL` vào health check:

```typescript
// Trong health check endpoint
const corpusDbStatus = await corpusPool.query('SELECT 1').then(() => 'ok').catch(e => e.message);
```

---

### 3. Tạo API endpoints trong `server/routes.ts`

```
GET  /api/corpus/search?q=<query>&sacThue=CIT,VAT&limit=10&importanceMax=2
GET  /api/corpus/document/:soHieu
GET  /api/corpus/anchors?sacThue=CIT
```

Response format:
```typescript
// GET /api/corpus/search
{
  results: CorpusSearchResult[],
  total: number,
  query: string
}

// GET /api/corpus/document/:soHieu
{
  document: CorpusDocument,
  chunks: CorpusChunk[]  // top-level chunks (dieu level)
}

// GET /api/corpus/anchors
{
  documents: CorpusDocument[]
}
```

---

### 4. Tích hợp vào AI context (`server/ai.ts`)

Khi AI trả lời câu hỏi thuế, bổ sung corpus context:

```typescript
// Trước khi gọi AI:
const corpusResults = await searchCorpus(userQuery, {
  importanceMax: 2,   // ưu tiên Luật + NĐ + TT
  conHieuLuc: true,
  limit: 5
});

// Thêm vào system prompt:
const corpusContext = corpusResults.map(r => {
  const doc = r.doc as CorpusDocument;
  return `[${doc.so_hieu}] ${doc.ten}\nTóm tắt: ${doc.tom_tat || 'N/A'}\nLink: ${doc.link_tvpl}`;
}).join('\n\n');

systemPrompt += `\n\n## Văn bản pháp luật liên quan:\n${corpusContext}`;
```

---

### 5. Env vars cần thêm vào Coolify

```
CORPUS_DATABASE_URL=postgresql://taxadvice_user:TaxAdvice2026!@10.0.1.11:5432/postgres
```

---

## Notes quan trọng

- **READ ONLY**: Tuyệt đối không INSERT/UPDATE/DELETE trên corpus DB
- **corpusPool** tách biệt hoàn toàn với `pool` (taxadvice app DB)
- `noi_dung` trong `documents` là HTML — cần strip tags khi đưa vào AI context
- `embedding` có thể NULL cho nhiều records — full-text search là fallback tốt
- Sắc thuế values: `CIT`, `VAT`, `PIT`, `TTDB`, `FCT`, `QLT`, `HoaDon`, `HKD`, `XNK`, `TaiNguyen`, `MonBai`, `GDLK`
- `is_anchor=true` = văn bản chủ chốt (Luật, NĐ hợp nhất) — ưu tiên khi cần context ngắn gọn

---

## Thứ tự implement

1. `server/corpus.ts` — pool + interfaces + query functions
2. Cập nhật `server/db.ts` — health check
3. API endpoints trong `server/routes.ts`
4. Tích hợp vào `server/ai.ts`
5. Xoá file BRIEF này, commit + push
