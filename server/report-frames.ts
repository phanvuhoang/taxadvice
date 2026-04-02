import type { ReportFrame } from "@shared/schema";

// ---- Industry Frame (S1-S7) ----
// Default topics for industry-level tax impact analysis

export const INDUSTRY_FRAME: ReportFrame[] = [
  {
    id: "S1",
    name: "Tổng quan ngành và môi trường thuế",
    enabled: true,
    subTopics: [
      "Đặc điểm ngành và ảnh hưởng đến nghĩa vụ thuế",
      "Các sắc thuế chính áp dụng cho ngành",
      "Xu hướng chính sách thuế gần đây",
      "So sánh gánh nặng thuế với các ngành khác",
    ],
  },
  {
    id: "S2",
    name: "Thuế Thu nhập Doanh nghiệp (TNDN)",
    enabled: true,
    subTopics: [
      "Thuế suất áp dụng và ưu đãi thuế TNDN trong ngành",
      "Điều kiện hưởng ưu đãi thuế TNDN",
      "Chi phí được trừ và không được trừ đặc thù ngành",
      "Chuyển lỗ và hoàn thuế TNDN",
      "Rủi ro về định giá chuyển nhượng (nếu có)",
    ],
  },
  {
    id: "S3",
    name: "Thuế Giá trị Gia tăng (GTGT)",
    enabled: true,
    subTopics: [
      "Thuế suất GTGT áp dụng cho sản phẩm/dịch vụ ngành",
      "Đầu vào được khấu trừ và không được khấu trừ",
      "Hoàn thuế GTGT — điều kiện và quy trình",
      "Rủi ro xuất hóa đơn và kê khai thuế GTGT",
    ],
  },
  {
    id: "S4",
    name: "Thuế Thu nhập Cá nhân (TNCN)",
    enabled: true,
    subTopics: [
      "Nghĩa vụ khấu trừ TNCN của doanh nghiệp trong ngành",
      "Các khoản thu nhập đặc thù ngành và cách tính TNCN",
      "Phụ lợi và quyền lợi nhân viên — xử lý thuế TNCN",
      "Người lao động nước ngoài trong ngành",
    ],
  },
  {
    id: "S5",
    name: "Thuế và nghĩa vụ tài chính khác",
    enabled: true,
    subTopics: [
      "Thuế tiêu thụ đặc biệt (nếu áp dụng)",
      "Thuế xuất nhập khẩu — ảnh hưởng đến chuỗi cung ứng",
      "Thuế nhà thầu nước ngoài (FCT) trong giao dịch ngành",
      "Phí, lệ phí, và các nghĩa vụ tài chính đặc thù ngành",
    ],
  },
  {
    id: "S6",
    name: "Tuân thủ thuế và quản lý rủi ro",
    enabled: true,
    subTopics: [
      "Nghĩa vụ kê khai và nộp thuế theo thời hạn",
      "Hóa đơn điện tử và yêu cầu lưu trữ chứng từ",
      "Các lỗi vi phạm thuế phổ biến trong ngành",
      "Thanh tra, kiểm tra thuế — kinh nghiệm ứng phó",
      "Phạt chậm nộp, tiền chậm nộp — tính toán và phòng ngừa",
    ],
  },
  {
    id: "S7",
    name: "Khuyến nghị và kế hoạch tối ưu thuế",
    enabled: true,
    subTopics: [
      "Tóm tắt rủi ro thuế trọng yếu",
      "Cơ hội tối ưu thuế hợp pháp trong ngành",
      "Kế hoạch hành động tuân thủ thuế",
      "Xu hướng chính sách thuế sắp tới cần theo dõi",
    ],
  },
];

// ---- Company Frame (C1-C7) ----
// Default topics for company-level tax impact analysis

export const COMPANY_FRAME: ReportFrame[] = [
  {
    id: "C1",
    name: "Thông tin công ty và cơ cấu thuế hiện tại",
    enabled: true,
    subTopics: [
      "Hình thức pháp lý và ảnh hưởng đến nghĩa vụ thuế",
      "Cơ cấu sở hữu và vấn đề thuế liên quan",
      "Địa bàn hoạt động — ưu đãi thuế theo khu vực/vùng",
      "Tổng quan nghĩa vụ thuế hiện tại",
    ],
  },
  {
    id: "C2",
    name: "Phân tích Thuế TNDN của công ty",
    enabled: true,
    subTopics: [
      "Thuế suất TNDN áp dụng và cơ sở tính thuế",
      "Ưu đãi thuế TNDN công ty đang/có thể hưởng",
      "Chi phí được trừ — đánh giá và tối ưu hóa",
      "Lỗ luỹ kế và kế hoạch sử dụng",
      "Dự phòng thuế TNDN hoãn lại",
    ],
  },
  {
    id: "C3",
    name: "Phân tích Thuế GTGT của công ty",
    enabled: true,
    subTopics: [
      "Doanh thu chịu thuế GTGT theo từng nhóm",
      "Hoàn thuế GTGT — tình hình và cơ hội",
      "Kiểm soát hóa đơn đầu vào không hợp lệ",
      "Rủi ro hoàn thuế và biện pháp phòng ngừa",
    ],
  },
  {
    id: "C4",
    name: "Thuế TNCN và lương thưởng",
    enabled: true,
    subTopics: [
      "Cơ cấu lương thưởng và tối ưu thuế TNCN",
      "Khấu trừ TNCN — kiểm tra tuân thủ",
      "Chính sách lợi ích nhân viên — xử lý thuế",
      "Nhân sự người nước ngoài — nghĩa vụ thuế",
    ],
  },
  {
    id: "C5",
    name: "Giao dịch liên kết và thuế quốc tế",
    enabled: true,
    subTopics: [
      "Xác định và kê khai giao dịch liên kết",
      "Phương pháp định giá chuyển nhượng",
      "Hiệp định tránh đánh thuế hai lần (DTT)",
      "Thuế nhà thầu trong giao dịch xuyên biên giới",
    ],
  },
  {
    id: "C6",
    name: "Tuân thủ và hồ sơ thuế",
    enabled: true,
    subTopics: [
      "Đánh giá mức độ tuân thủ kê khai thuế hiện tại",
      "Hệ thống kiểm soát nội bộ về thuế",
      "Hồ sơ, chứng từ — đánh giá đầy đủ và hợp lệ",
      "Lịch sử thanh kiểm tra thuế và kết quả",
    ],
  },
  {
    id: "C7",
    name: "Rủi ro, cơ hội và kế hoạch hành động",
    enabled: true,
    subTopics: [
      "Ma trận rủi ro thuế — mức độ và khả năng xảy ra",
      "Cơ hội tiết kiệm thuế hợp pháp",
      "Kế hoạch hành động ưu tiên theo quý/năm",
      "Chỉ số KPI tuân thủ thuế cần theo dõi",
    ],
  },
];

/**
 * Get the default frame for the given type.
 * @param type "industry" | "company" | "both"
 * @param industry Optional industry name for customizing topic names
 * @param company Optional company name for customizing topic names
 */
export function getDefaultFrame(
  type: "industry" | "company" | "both",
  industry?: string,
  company?: string
): ReportFrame[] {
  if (type === "industry") {
    return INDUSTRY_FRAME.map(frame => ({
      ...frame,
      subTopics: [...frame.subTopics],
      name: industry ? frame.name.replace("ngành", `ngành ${industry}`).replace("Tổng quan ngành", `Tổng quan ngành ${industry}`) : frame.name,
    }));
  }

  if (type === "company") {
    return COMPANY_FRAME.map(frame => ({
      ...frame,
      subTopics: [...frame.subTopics],
      name: company ? frame.name.replace("công ty", `${company}`).replace("Thông tin công ty", `Thông tin ${company}`) : frame.name,
    }));
  }

  // Both — merge and deduplicate
  return mergeFrames(
    getDefaultFrame("industry", industry),
    getDefaultFrame("company", company)
  );
}

/**
 * Merge industry and company frames, deduplicating by topic name similarity.
 */
export function mergeFrames(
  industryFrame: ReportFrame[],
  companyFrame: ReportFrame[]
): ReportFrame[] {
  const merged: ReportFrame[] = [];
  const seenNames = new Set<string>();

  // Add all industry frames first
  for (const frame of industryFrame) {
    const normalizedName = frame.name.toLowerCase().trim();
    if (!seenNames.has(normalizedName)) {
      seenNames.add(normalizedName);
      merged.push({ ...frame, subTopics: [...frame.subTopics] });
    }
  }

  // Add company frames, merge sub-topics if same topic area found
  for (const frame of companyFrame) {
    const normalizedName = frame.name.toLowerCase().trim();
    if (!seenNames.has(normalizedName)) {
      // Check for similar topic by keyword overlap
      const existingIdx = merged.findIndex(m => {
        const mWords = m.name.toLowerCase().split(/\s+/);
        const fWords = frame.name.toLowerCase().split(/\s+/);
        const overlap = mWords.filter(w => w.length > 3 && fWords.includes(w));
        return overlap.length >= 2;
      });

      if (existingIdx >= 0) {
        // Merge sub-topics into existing
        const existing = merged[existingIdx];
        const newSubTopics = frame.subTopics.filter(
          st => !existing.subTopics.some(
            est => est.toLowerCase().includes(st.toLowerCase().slice(0, 10))
          )
        );
        merged[existingIdx] = {
          ...existing,
          subTopics: [...existing.subTopics, ...newSubTopics],
        };
      } else {
        seenNames.add(normalizedName);
        merged.push({ ...frame, subTopics: [...frame.subTopics] });
      }
    }
  }

  return merged;
}
