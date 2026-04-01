import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://localhost:5432/taxadvice",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL error:", err);
});

export default pool;

// Initialize app tables (does not touch existing 'documents' table)
export async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS password_resets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES app_users(id) ON DELETE CASCADE,
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS document_chunks (
        id SERIAL PRIMARY KEY,
        document_id INTEGER NOT NULL,
        chunk_text TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        article_ref VARCHAR(500),
        section_path TEXT,
        embedding vector(1536),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Full-text search column
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'document_chunks' AND column_name = 'tsvector_content'
        ) THEN
          ALTER TABLE document_chunks ADD COLUMN tsvector_content TSVECTOR;
        END IF;
      END $$;

      CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON document_chunks(document_id);
      CREATE INDEX IF NOT EXISTS idx_chunks_tsvector ON document_chunks USING GIN(tsvector_content);
      CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON document_chunks USING ivfflat(embedding vector_cosine_ops) WITH (lists = 50);

      CREATE TABLE IF NOT EXISTS outputs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES app_users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL CHECK (type IN ('quick_qa', 'scenario', 'article', 'report', 'tax_advice')),
        title VARCHAR(500),
        question TEXT,
        content TEXT,
        citations JSONB,
        status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('processing', 'completed', 'failed')),
        ai_model VARCHAR(50),
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_outputs_user_id ON outputs(user_id);
      CREATE INDEX IF NOT EXISTS idx_outputs_type ON outputs(type);
      CREATE INDEX IF NOT EXISTS idx_outputs_status ON outputs(status);

      CREATE TABLE IF NOT EXISTS report_topics (
        id SERIAL PRIMARY KEY,
        output_id INTEGER REFERENCES outputs(id) ON DELETE CASCADE,
        name VARCHAR(500) NOT NULL,
        parent_id INTEGER REFERENCES report_topics(id) ON DELETE CASCADE,
        sort_order INTEGER DEFAULT 0,
        content TEXT,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_report_topics_output_id ON report_topics(output_id);
    `);

    // Create pgvector extension if not exists (may need superuser)
    try {
      await client.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
    } catch (e) {
      console.warn("pgvector extension may already exist or need superuser:", (e as Error).message);
    }

    // Create default admin if not exists
    const adminCheck = await client.query(
      `SELECT id FROM app_users WHERE role = 'admin' LIMIT 1`
    );
    if (adminCheck.rows.length === 0) {
      const bcrypt = await import("bcryptjs");
      const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || "admin123", 12);
      await client.query(
        `INSERT INTO app_users (email, password_hash, name, role) VALUES ($1, $2, $3, 'admin')
         ON CONFLICT (email) DO NOTHING`,
        [process.env.ADMIN_EMAIL || "admin@taxadvice.vn", hash, "Admin"]
      );
      console.log("Default admin user created");
    }

    console.log("Database initialized successfully");
  } catch (err) {
    console.error("Database initialization error:", err);
    throw err;
  } finally {
    client.release();
  }
}
