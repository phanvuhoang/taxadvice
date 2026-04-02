import AIFeaturePage from "./ai-feature";

export default function TaxAdvicePage() {
  return (
    <AIFeaturePage
      type="tax_advice"
      title="Thư tư vấn thuế"
      description="Soạn thư tư vấn thuế chuyên nghiệp (professional tax advice letter) dài 1-2 trang A4"
      placeholder="Ví dụ: Công ty X (ngành sản xuất) muốn mua bảo hiểm sức khỏe cho toàn bộ nhân viên với mức phí 10 triệu/người/năm. Hỏi: (1) Chi phí này có được trừ khi tính thuế TNDN không? (2) Có phải tính thuế TNCN cho nhân viên không? (3) Các điều kiện và giới hạn?"
      apiEndpoint="/api/ai/tax-advice"
      inputLabel="Tình huống cần tư vấn"
      inputField="scenario"
      showClientFields
      showStyleRefs
    />
  );
}
