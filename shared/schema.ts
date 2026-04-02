import { z } from "zod";

// ---- Types matching PostgreSQL tables ----

// Existing documents table (read-only)
export interface Document {
  id: number;
  so_hieu: string;
  ten: string;
  loai: string;
  co_quan: string;
  ngay_ban_hanh: string;
  hieu_luc_tu: string;
  het_hieu_luc_tu: string | null;
  tinh_trang: string;
  sac_thue: string[];
  chu_de: string[];
  noi_dung: string;
  tom_tat: string;
  link_tvpl: string;
  importance: number;
  hieu_luc_index: any;
  is_anchor: boolean;
  anchor_from: string | null;
  anchor_to: string | null;
  keywords: string[];
  github_path: string;
}

export interface DocumentSummary {
  id: number;
  so_hieu: string;
  ten: string;
  loai: string;
  co_quan: string;
  ngay_ban_hanh: string;
  hieu_luc_tu: string;
  het_hieu_luc_tu: string | null;
  tinh_trang: string;
  sac_thue: string[];
  importance: number;
  is_anchor: boolean;
}

// App users
export interface AppUser {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  role: "admin" | "user";
  created_at: string;
  updated_at: string;
}

export interface AppUserPublic {
  id: number;
  email: string;
  name: string;
  role: "admin" | "user";
  created_at: string;
}

// Document chunks
export interface DocumentChunk {
  id: number;
  document_id: number;
  chunk_text: string;
  chunk_index: number;
  article_ref: string | null;
  section_path: string | null;
  created_at: string;
}

// Outputs
export interface Output {
  id: number;
  user_id: number;
  type: "quick_qa" | "scenario" | "article" | "report" | "tax_advice" | "press_article";
  title: string;
  question: string | null;
  content: string | null;
  citations: Citation[] | null;
  status: "processing" | "completed" | "failed";
  ai_model: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface Citation {
  document_id: number;
  so_hieu: string;
  article_ref: string;
  excerpt: string;
  url?: string;
}

// Report topics
export interface ReportTopic {
  id: number;
  output_id: number;
  name: string;
  parent_id: number | null;
  sort_order: number;
  content: string | null;
  status: "pending" | "processing" | "completed" | "failed";
  created_at: string;
}

// Password resets
export interface PasswordReset {
  id: number;
  user_id: number;
  token: string;
  expires_at: string;
  used: boolean;
  created_at: string;
}

// Report Frame for industry/company analysis
export interface ReportFrame {
  id: string;       // "S1", "C1" etc.
  name: string;
  enabled: boolean;
  subTopics: string[];
}

// Gamma generation result
export interface GammaResult {
  generationId: string;
  status: "pending" | "processing" | "completed" | "failed";
  gammaUrl?: string;
  pptxUrl?: string;
}

// ---- Zod Schemas for validation ----

export const registerSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự"),
  name: z.string().min(1, "Tên không được để trống"),
});

export const loginSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(1, "Mật khẩu không được để trống"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự"),
});

export const quickQASchema = z.object({
  question: z.string().min(1, "Câu hỏi không được để trống"),
  sac_thue: z.array(z.string()).optional(),
  ai_model: z.enum(["deepseek", "anthropic"]).default("deepseek"),
  style_references: z.array(z.string()).max(5).optional(),
});

export const scenarioSchema = z.object({
  scenario: z.string().min(1, "Tình huống không được để trống"),
  sac_thue: z.array(z.string()).optional(),
  ai_model: z.enum(["deepseek", "anthropic"]).default("deepseek"),
  style_references: z.array(z.string()).max(5).optional(),
});

export const articleSchema = z.object({
  topic: z.string().min(1, "Chủ đề không được để trống"),
  sac_thue: z.array(z.string()).optional(),
  ai_model: z.enum(["deepseek", "anthropic"]).default("deepseek"),
  style_references: z.array(z.string()).max(5).optional(),
});

export const pressArticleSchema = z.object({
  topic: z.string().min(1, "Chủ đề không được để trống"),
  sac_thue: z.array(z.string()).optional(),
  ai_model: z.enum(["deepseek", "anthropic"]).default("deepseek"),
  style_references: z.array(z.string()).max(5).optional(),
});

export const reportSchema = z.object({
  title: z.string().min(1, "Tiêu đề không được để trống"),
  description: z.string().optional(),
  industry: z.string().optional(),
  company: z.string().optional(),
  ai_model: z.enum(["deepseek", "anthropic"]).default("deepseek"),
  topics: z.array(z.object({
    id: z.string(),
    name: z.string(),
    enabled: z.boolean().default(true),
    subTopics: z.array(z.string()),
    parentId: z.string().nullable().optional(),
  })).optional(),
  sac_thue: z.array(z.string()).optional(),
  style_references: z.array(z.string()).max(5).optional(),
});

export const topicSchema = z.object({
  name: z.string().min(1, "Tên chủ đề không được để trống"),
  parent_id: z.number().nullable().optional(),
  sort_order: z.number().optional(),
});

export const taxAdviceSchema = z.object({
  scenario: z.string().min(1, "Tình huống không được để trống"),
  client_name: z.string().optional(),
  company_name: z.string().optional(),
  sac_thue: z.array(z.string()).optional(),
  ai_model: z.enum(["deepseek", "anthropic"]).default("deepseek"),
  style_references: z.array(z.string()).max(5).optional(),
});

// Sac thue options
export const SAC_THUE_OPTIONS = [
  { value: "TNDN", label: "Thuế Thu nhập Doanh nghiệp" },
  { value: "GTGT", label: "Thuế Giá trị Gia tăng" },
  { value: "TNCN", label: "Thuế Thu nhập Cá nhân" },
  { value: "FCT", label: "Thuế Nhà thầu Nước ngoài" },
  { value: "TTDB", label: "Thuế Tiêu thụ Đặc biệt" },
  { value: "XNK", label: "Thuế Xuất nhập Khẩu" },
  { value: "QLT", label: "Quản lý Thuế" },
  { value: "HOA_DON", label: "Hóa đơn" },
  { value: "HKD", label: "Hộ kinh doanh" },
  { value: "GDLK", label: "Giao dịch Liên kết" },
  { value: "THUE_QT", label: "Thuế Quốc tế" },
] as const;

export type SacThue = typeof SAC_THUE_OPTIONS[number]["value"];

export type InsertUser = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type QuickQAInput = z.infer<typeof quickQASchema>;
export type ScenarioInput = z.infer<typeof scenarioSchema>;
export type ArticleInput = z.infer<typeof articleSchema>;
export type PressArticleInput = z.infer<typeof pressArticleSchema>;
export type ReportInput = z.infer<typeof reportSchema>;
export type TopicInput = z.infer<typeof topicSchema>;
export type TaxAdviceInput = z.infer<typeof taxAdviceSchema>;
