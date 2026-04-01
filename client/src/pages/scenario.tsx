import AIFeaturePage from "./ai-feature";

export default function ScenarioPage() {
  return (
    <AIFeaturePage
      type="scenario"
      title="Tình huống thuế"
      description="Mô tả tình huống thuế cụ thể để nhận phân tích và hướng xử lý"
      placeholder="Ví dụ: Công ty A ký hợp đồng thuê nhà để làm văn phòng với cá nhân B, giá thuê 20 triệu/tháng. Cá nhân B không có đăng ký kinh doanh. Hỏi: (1) Công ty A cần những chứng từ gì để được khấu trừ chi phí? (2) Nghĩa vụ thuế TNCN và GTGT như thế nào?"
      apiEndpoint="/api/ai/scenario"
      inputLabel="Tình huống"
      inputField="scenario"
    />
  );
}
