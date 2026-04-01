# TaxAdvice - Hệ thống Tư vấn Thuế Doanh nghiệp Việt Nam

Ứng dụng web hỗ trợ tư vấn và nghiên cứu thuế doanh nghiệp Việt Nam, dành cho chuyên gia thuế, kiểm toán viên và doanh nghiệp.

## Chức năng chính

1. **Tra cứu nhanh** - Hỏi đáp về quy định thuế, trích dẫn chính xác điều khoản pháp luật
2. **Tình huống thuế** - Phân tích tình huống thuế cụ thể với căn cứ pháp lý
3. **Bài phân tích** - Tạo bài viết phân tích chuyên sâu về chủ đề thuế
4. **Báo cáo chuyên sâu** - Báo cáo phân tích tác động thuế theo ngành/công ty (background processing)
5. **Thư tư vấn** - Soạn professional tax advice letter (1-2 trang A4)

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL (pgvector cho semantic search)
- **AI**: DeepSeek Reasoner + Anthropic Haiku 4.5
- **Search**: Hybrid search (full-text + semantic + RRF)
- **Auth**: JWT + bcrypt + SMTP (forgot password)
- **Export**: PDF generation

## Cài đặt

### Prerequisites
- Node.js 20+
- PostgreSQL 15+ với pgvector extension
- API keys: DeepSeek, Anthropic, OpenAI (cho embeddings)

### Development
```bash
npm install
cp .env.example .env  # Sửa các giá trị trong .env
npm run dev
```

### Docker (Production)
```bash
docker build -t taxadvice .
docker run -p 5000:5000 --env-file .env taxadvice
```

### Deploy trên Coolify
1. Tạo service mới từ GitHub repo `phanvuhoang/taxadvice`
2. Build Pack: Dockerfile
3. Cấu hình Environment Variables (xem `.env.example`)
4. Database: dùng chung PostgreSQL đã có văn bản thuế
5. Network: đảm bảo container có thể kết nối đến PostgreSQL

## Environment Variables

| Variable | Bắt buộc | Mô tả |
|----------|----------|-------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Secret key cho JWT tokens |
| `DEEPSEEK_API_KEY` | ✅ | DeepSeek API key |
| `ANTHROPIC_API_KEY` | ✅ | Anthropic API key |
| `OPENAI_API_KEY` | ✅ | OpenAI API key (cho embeddings) |
| `SMTP_HOST` | ⚡ | SMTP server (cho forgot password) |
| `SMTP_PORT` | ⚡ | SMTP port (587 hoặc 465) |
| `SMTP_USER` | ⚡ | SMTP username/email |
| `SMTP_PASS` | ⚡ | SMTP password/app password |
| `ADMIN_EMAIL` | ❌ | Email admin mặc định (default: admin@taxadvice.vn) |
| `ADMIN_PASSWORD` | ❌ | Password admin mặc định (default: admin123) |
| `PERPLEXITY_API_KEY` | ❌ | Perplexity API (cho internet research) |
| `PORT` | ❌ | Port (default: 5000) |

## Hybrid Search Architecture

App sử dụng hybrid search kết hợp:
1. **Full-text search** (PostgreSQL `tsvector`) - tìm keyword chính xác
2. **Semantic search** (pgvector embeddings) - tìm theo ngữ nghĩa
3. **RRF (Reciprocal Rank Fusion)** - kết hợp kết quả từ 2 phương pháp

### Document Chunking
- Văn bản thuế HTML được parse tự động theo cấu trúc: Chương → Mục → Điều → Khoản
- Mỗi chunk lưu kèm `article_ref` (VD: "Điều 9, Khoản 4") và `section_path`
- Embeddings (OpenAI text-embedding-3-small, 1536 chiều) cho mỗi chunk

### Khởi tạo Chunks
Sau khi deploy, đăng nhập với tài khoản admin và vào **Quản trị > Dữ liệu > Rebuild**.
Chọn "Anchor only" để chỉ xử lý ~20 văn bản quan trọng, hoặc "Tất cả" cho toàn bộ 186 văn bản.

## Cấu trúc Database

App tạo thêm các bảng sau (không ảnh hưởng bảng `documents` hiện có):
- `app_users` - Người dùng
- `password_resets` - Reset password tokens
- `document_chunks` - Chunks + embeddings cho search
- `outputs` - Kết quả đã lưu
- `report_topics` - Topics cho báo cáo chuyên sâu
