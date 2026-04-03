import type { ReportFrame } from "@shared/schema";

// ---- Scenario A: Industry only (S1-S7) ----
export const INDUSTRY_FRAME: ReportFrame[] = [
  { id: "S1", name: "Tổng quan về ngành", enabled: true, subTopics: ["Quy mô thị trường", "Đặc điểm kinh doanh", "Mô hình doanh thu/chi phí"] },
  { id: "S2", name: "Đặc thù kinh doanh", enabled: true, subTopics: ["Chuỗi giá trị", "Chuỗi cung ứng", "Working capital cycle", "Đặc điểm tài sản"] },
  { id: "S3", name: "Các quy định pháp lý", enabled: true, subTopics: ["Luật chuyên ngành", "Điều kiện kinh doanh", "Hạn chế FDI"] },
  { id: "S4", name: "Phân tích các loại thuế áp dụng", enabled: true, subTopics: ["Thuế TNDN", "Thuế GTGT", "Thuế Nhà thầu", "Thuế TTĐB", "Thuế XNK"] },
  { id: "S5", name: "Các vấn đề thuế đặc thù", enabled: true, subTopics: ["Rủi ro doanh thu/chi phí", "Chuyển giá", "Ưu đãi thuế", "Hóa đơn đặc thù", "Tranh chấp thuế", "Công văn hướng dẫn đặc thù"] },
  { id: "S6", name: "Thông lệ thuế quốc tế (nếu có)", enabled: true, subTopics: ["BEPS 2.0", "Chuyển giá quốc tế", "So sánh khu vực", "Hiệp định thuế"] },
  { id: "S7", name: "Khuyến nghị & Kết luận", enabled: true, subTopics: ["Tối ưu hóa thuế", "Tuân thủ", "Cơ hội ưu đãi", "Rủi ro cần theo dõi"] },
];

// ---- Scenario B: Company only (C1-C7) ----
export const COMPANY_FRAME: ReportFrame[] = [
  { id: "C1", name: "Giới thiệu công ty", enabled: true, subTopics: ["Lịch sử hình thành", "Cơ cấu sở hữu & cổ đông", "Ngành nghề kinh doanh chính", "Quy mô: doanh thu, nhân sự, tài sản"] },
  { id: "C2", name: "Mô hình kinh doanh & chuỗi giá trị", enabled: true, subTopics: ["Sản phẩm/dịch vụ chính", "Khách hàng mục tiêu", "Nhà cung cấp & đối tác", "Chuỗi giá trị nội bộ"] },
  { id: "C3", name: "Cấu trúc pháp lý & giao dịch liên kết", enabled: true, subTopics: ["Sơ đồ tổ chức pháp nhân", "Các bên liên kết (Điều 5 NĐ 132/2020)", "Giao dịch liên kết phát sinh", "Nghĩa vụ kê khai Form 01"] },
  { id: "C4", name: "Phân tích tài chính & gánh nặng thuế", enabled: true, subTopics: ["Doanh thu & lợi nhuận 3-5 năm", "Tỷ lệ thuế TNDN hiệu quả (ETR)", "So sánh ETR với trung bình ngành", "Các khoản không được khấu trừ lớn"] },
  { id: "C5", name: "Rủi ro thuế đặc thù", enabled: true, subTopics: ["Rủi ro thanh tra thuế (lịch sử)", "Chuyển giá & arm's length", "Ưu đãi thuế đang áp dụng", "Hóa đơn đặc thù", "Tranh chấp thuế & án lệ liên quan", "Công văn/ruling đặc thù"] },
  { id: "C6", name: "Tuân thủ & quản trị thuế", enabled: true, subTopics: ["Quy trình kê khai nội bộ", "Kiểm soát nội bộ về thuế", "Rủi ro xử phạt chậm nộp", "Nhân sự & năng lực thuế"] },
  { id: "C7", name: "Khuyến nghị chiến lược thuế", enabled: true, subTopics: ["Tối ưu hóa cấu trúc thuế", "Cơ hội ưu đãi chưa tận dụng", "Rủi ro cần theo dõi ngay", "Lộ trình cải thiện tuân thủ"] },
];

// ---- Scenario C: Both industry AND company (T1-T8) ----
export const COMBINED_FRAME: ReportFrame[] = [
  { id: "T1", name: "Tổng quan về ngành", enabled: true, subTopics: ["Quy mô thị trường", "Đặc điểm kinh doanh", "Mô hình doanh thu/chi phí", "Chuỗi giá trị", "Chuỗi cung ứng"] },
  { id: "T2", name: "Giới thiệu công ty", enabled: true, subTopics: ["Lịch sử hình thành", "Cơ cấu sở hữu & cổ đông", "Ngành nghề kinh doanh chính", "Quy mô: doanh thu, nhân sự, tài sản"] },
  { id: "T3", name: "Mô hình kinh doanh & chuỗi giá trị", enabled: true, subTopics: ["Sản phẩm/dịch vụ chính", "Khách hàng mục tiêu", "Nhà cung cấp & đối tác", "Chuỗi giá trị nội bộ", "Chuỗi cung ứng", "So sánh với ngành"] },
  { id: "T4", name: "Các vấn đề thuế đặc thù của ngành", enabled: true, subTopics: ["Rủi ro doanh thu/chi phí", "Chuyển giá", "Ưu đãi thuế", "Hóa đơn đặc thù", "Tranh chấp thuế", "Công văn hướng dẫn đặc thù"] },
  { id: "T5", name: "Phân tích tài chính & gánh nặng thuế của công ty", enabled: true, subTopics: ["Doanh thu & lợi nhuận 3-5 năm", "Tỷ lệ thuế TNDN hiệu quả (ETR)", "So sánh ETR với trung bình ngành", "Các khoản không được khấu trừ lớn"] },
  { id: "T6", name: "Rủi ro thuế đặc thù của công ty", enabled: true, subTopics: ["Rủi ro thanh tra thuế (lịch sử)", "Chuyển giá & arm's length", "Ưu đãi thuế đang áp dụng", "Hóa đơn đặc thù", "Tranh chấp thuế & án lệ liên quan", "Công văn/ruling đặc thù"] },
  { id: "T7", name: "Tuân thủ & quản trị thuế", enabled: true, subTopics: ["Quy trình kê khai nội bộ", "Kiểm soát nội bộ về thuế", "Rủi ro xử phạt chậm nộp", "Nhân sự & năng lực thuế"] },
  { id: "T8", name: "Khuyến nghị chiến lược thuế", enabled: true, subTopics: ["Tối ưu hóa cấu trúc thuế", "Cơ hội ưu đãi chưa tận dụng", "Rủi ro cần theo dõi ngay", "Lộ trình cải thiện tuân thủ"] },
];

/**
 * Get the default report frame.
 * - Industry only → S1-S7 (customize names with industry name)
 * - Company only → C1-C7 (customize names with company name)
 * - Both → T1-T8 (customize names with both)
 */
export function getDefaultFrame(
  type: "industry" | "company" | "both",
  industry?: string,
  company?: string
): ReportFrame[] {
  if (type === "industry") {
    return INDUSTRY_FRAME.map(f => ({
      ...f,
      subTopics: [...f.subTopics],
      name: industry ? f.name.replace("ngành", `ngành ${industry}`) : f.name,
    }));
  }

  if (type === "company") {
    return COMPANY_FRAME.map(f => ({
      ...f,
      subTopics: [...f.subTopics],
      name: company ? f.name.replace("công ty", company) : f.name,
    }));
  }

  // Both — use the explicit COMBINED_FRAME (T1-T8)
  return COMBINED_FRAME.map(f => {
    let name = f.name;
    if (industry) name = name.replace("ngành", `ngành ${industry}`);
    if (company) name = name.replace("công ty", company);
    return { ...f, subTopics: [...f.subTopics], name };
  });
}

// Keep for backward compatibility but not used for "both" anymore
export function mergeFrames(
  industryFrame: ReportFrame[],
  companyFrame: ReportFrame[]
): ReportFrame[] {
  return [...industryFrame, ...companyFrame];
}
