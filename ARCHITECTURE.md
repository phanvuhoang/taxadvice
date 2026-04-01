# TaxAdvice App Architecture

## Overview
Vietnamese corporate tax advisory web application for tax experts, auditors, and businesses.
All output in Vietnamese. Deployed on Coolify VPS with PostgreSQL.

## Tech Stack
- Frontend: React + Vite + Tailwind CSS + shadcn/ui
- Backend: Express.js + TypeScript
- Database: PostgreSQL (shared with tax document database)
- Search: Hybrid (pg full-text + pgvector semantic)
- AI: DeepSeek (deepseek-reasoner) + Anthropic (claude-3-5-haiku-20241022)
- Auth: JWT + bcrypt + nodemailer (SMTP for forgot password)
- Export: PDFKit for PDF generation

## Database (PostgreSQL)

### Existing table: documents (186 records - DO NOT MODIFY)
Already has: id, so_hieu, ten, loai, co_quan, ngay_ban_hanh, hieu_luc_tu, het_hieu_luc_tu,
tinh_trang, sac_thue (varchar[]), chu_de (varchar[]), noi_dung (text/HTML), tom_tat, 
link_tvpl, importance, hieu_luc_index (jsonb), is_anchor, anchor_from, anchor_to,
embedding (vector 1536), keywords (text[]), github_path

### New tables for app:

#### app_users
- id SERIAL PRIMARY KEY
- email VARCHAR(255) UNIQUE NOT NULL
- password_hash VARCHAR(255) NOT NULL
- name VARCHAR(255) NOT NULL
- role VARCHAR(20) DEFAULT 'user' (admin/user)
- created_at TIMESTAMPTZ DEFAULT NOW()
- updated_at TIMESTAMPTZ DEFAULT NOW()

#### password_resets
- id SERIAL PRIMARY KEY
- user_id INTEGER REFERENCES app_users(id)
- token VARCHAR(255) UNIQUE NOT NULL
- expires_at TIMESTAMPTZ NOT NULL
- used BOOLEAN DEFAULT FALSE
- created_at TIMESTAMPTZ DEFAULT NOW()

#### document_chunks
- id SERIAL PRIMARY KEY
- document_id INTEGER REFERENCES documents(id)
- chunk_text TEXT NOT NULL
- chunk_index INTEGER NOT NULL
- article_ref VARCHAR(500) (e.g. "Điều 9, Khoản 4, Mục a")
- section_path TEXT (e.g. "Chương II > Mục 1 > Điều 9")
- embedding VECTOR(1536)
- tsvector_content TSVECTOR
- created_at TIMESTAMPTZ DEFAULT NOW()

#### outputs
- id SERIAL PRIMARY KEY
- user_id INTEGER REFERENCES app_users(id)
- type VARCHAR(50) NOT NULL (quick_qa, scenario, article, report, tax_advice)
- title VARCHAR(500)
- question TEXT
- content TEXT (markdown content)
- citations JSONB (array of {document_id, so_hieu, article_ref, excerpt})
- status VARCHAR(20) DEFAULT 'completed' (processing, completed, failed)
- ai_model VARCHAR(50)
- metadata JSONB
- created_at TIMESTAMPTZ DEFAULT NOW()
- updated_at TIMESTAMPTZ DEFAULT NOW()

#### report_topics
- id SERIAL PRIMARY KEY
- output_id INTEGER REFERENCES outputs(id) ON DELETE CASCADE
- name VARCHAR(500) NOT NULL
- parent_id INTEGER REFERENCES report_topics(id) ON DELETE CASCADE
- sort_order INTEGER DEFAULT 0
- content TEXT (generated content for this topic)
- status VARCHAR(20) DEFAULT 'pending'
- created_at TIMESTAMPTZ DEFAULT NOW()

## API Routes

### Auth
- POST /api/auth/register - Register new user
- POST /api/auth/login - Login, returns JWT
- POST /api/auth/forgot-password - Send reset email
- POST /api/auth/reset-password - Reset with token
- GET /api/auth/me - Get current user

### Documents (read-only from existing DB)
- GET /api/documents - List documents (with filters)
- GET /api/documents/:id - Get document detail
- GET /api/documents/search - Search documents

### Outputs
- GET /api/outputs - List user's outputs (paginated)
- GET /api/outputs/:id - Get output detail
- DELETE /api/outputs/:id - Delete output

### AI Features
- POST /api/ai/quick-qa - Quick tax Q&A
- POST /api/ai/scenario - Tax scenario Q&A
- POST /api/ai/article - Generate analysis article
- POST /api/ai/report - Start report generation (background)
- GET /api/ai/report/:id/status - Check report status
- POST /api/ai/tax-advice - Generate tax advice letter

### Report Topics
- GET /api/reports/:id/topics - Get topics for a report
- POST /api/reports/:id/topics - Add topic
- PUT /api/reports/:id/topics/:topicId - Update topic
- DELETE /api/reports/:id/topics/:topicId - Delete topic

### Admin
- GET /api/admin/users - List all users
- PUT /api/admin/users/:id - Update user role
- DELETE /api/admin/users/:id - Delete user
- POST /api/admin/chunks/rebuild - Rebuild document chunks

### Export
- GET /api/outputs/:id/export/pdf - Export as PDF

## Frontend Pages
- /login - Login page
- /register - Register page
- /forgot-password - Forgot password
- /reset-password - Reset password
- / - Dashboard (recent outputs)
- /quick-qa - Quick tax Q&A
- /scenario - Tax scenario Q&A
- /article - Article generation
- /report - Report generation with topic editor
- /tax-advice - Tax advice letter
- /outputs - All saved outputs
- /outputs/:id - View output detail
- /documents - Browse tax documents
- /admin - Admin panel (users, chunks management)

## Environment Variables
DATABASE_URL, JWT_SECRET, DEEPSEEK_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY,
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, PERPLEXITY_API_KEY (optional)
