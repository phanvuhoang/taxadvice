import AIFeaturePage from "./ai-feature";

export default function ArticlePage() {
  return (
    <AIFeaturePage
      type="article"
      title="Bài phân tích"
      description="Tạo bài viết phân tích chuyên sâu về một chủ đề thuế cụ thể"
      placeholder="Ví dụ: Phân tích chi tiết cách lập hóa đơn điều chỉnh tăng giảm theo Nghị định 70/2025, bao gồm các trường hợp cụ thể và ví dụ minh họa"
      apiEndpoint="/api/ai/article"
      inputLabel="Chủ đề bài viết"
      inputField="topic"
    />
  );
}
