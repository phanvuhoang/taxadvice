import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, MessageSquareText, FileText, BarChart3, ScrollText, Clock, ArrowRight, Newspaper } from "lucide-react";
import { authFetch } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const features = [
  { path: "/quick-qa", label: "Tra cứu nhanh", desc: "Hỏi đáp về quy định thuế, trích dẫn chính xác điều khoản", icon: Search, color: "text-blue-600 dark:text-blue-400" },
  { path: "/scenario", label: "Tình huống thuế", desc: "Phân tích tình huống thuế cụ thể với căn cứ pháp lý", icon: MessageSquareText, color: "text-emerald-600 dark:text-emerald-400" },
  { path: "/article", label: "Bài phân tích", desc: "Tạo bài viết phân tích chuyên sâu về chủ đề thuế", icon: FileText, color: "text-amber-600 dark:text-amber-400" },
  { path: "/press-article", label: "Bài viết báo", desc: "Tạo bài viết báo có storytelling, ví dụ thực tế, ngôn ngữ dễ hiểu cho độc giả phổ thông", icon: Newspaper, color: "text-cyan-600 dark:text-cyan-400" },
  { path: "/report", label: "Báo cáo chuyên sâu", desc: "Báo cáo tác động thuế theo ngành hoặc công ty", icon: BarChart3, color: "text-purple-600 dark:text-purple-400" },
  { path: "/tax-advice", label: "Thư tư vấn", desc: "Soạn thư tư vấn thuế chuyên nghiệp (1-2 trang A4)", icon: ScrollText, color: "text-rose-600 dark:text-rose-400" },
];

const typeLabels: Record<string, string> = {
  quick_qa: "Tra cứu",
  scenario: "Tình huống",
  article: "Bài viết",
  press_article: "Bài báo",
  report: "Báo cáo",
  tax_advice: "Tư vấn",
};

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/outputs", "?limit=5"],
    queryFn: async () => {
      const res = await authFetch("/api/outputs?limit=5");
      return res.json();
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold" data-testid="text-dashboard-title">Trang chủ</h1>
        <p className="text-sm text-muted-foreground mt-1">Chọn chức năng để bắt đầu tư vấn thuế</p>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {features.map((f) => (
          <Link key={f.path} href={f.path}>
            <Card className="cursor-pointer hover:shadow-md transition-shadow group h-full" data-testid={`card-feature-${f.path.replace("/", "")}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 ${f.color}`}>
                    <f.icon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium group-hover:text-primary transition-colors">{f.label}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{f.desc}</p>
                  </div>
                  <ArrowRight size={14} className="text-muted-foreground/40 group-hover:text-primary transition-colors mt-1" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent outputs */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Clock size={16} className="text-muted-foreground" />
              Kết quả gần đây
            </CardTitle>
            <Link href="/outputs">
              <Button variant="ghost" size="sm" className="text-xs">Xem tất cả</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : data?.outputs?.length > 0 ? (
            <div className="space-y-1">
              {data.outputs.map((o: any) => (
                <Link key={o.id} href={`/outputs/${o.id}`}>
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent/50 cursor-pointer transition-colors" data-testid={`output-item-${o.id}`}>
                    <Badge variant="outline" className="text-[10px] font-normal shrink-0">
                      {typeLabels[o.type] || o.type}
                    </Badge>
                    <span className="text-sm truncate flex-1">{o.title}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(o.created_at).toLocaleDateString("vi-VN")}
                    </span>
                    {o.status === "processing" && (
                      <Badge variant="secondary" className="text-[10px] animate-pulse">Đang xử lý</Badge>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">
              Chưa có kết quả nào. Bắt đầu bằng cách chọn một chức năng ở trên.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
