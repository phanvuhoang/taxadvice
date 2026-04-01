import AIFeaturePage from "./ai-feature";

export default function QuickQAPage() {
  return (
    <AIFeaturePage
      type="quick_qa"
      title="Tra cứu nhanh"
      description="Đặt câu hỏi thuế cụ thể, nhận câu trả lời có trích dẫn điều khoản pháp luật"
      placeholder="Ví dụ: Chi phí tiền thuê nhà cho nhân viên có được tính vào chi phí được trừ khi tính thuế TNDN không?"
      apiEndpoint="/api/ai/quick-qa"
      inputLabel="Câu hỏi"
      inputField="question"
    />
  );
}
