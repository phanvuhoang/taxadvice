import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Download, Copy, Check } from "lucide-react";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { authFetch } from "@/lib/auth";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { Citation } from "@shared/schema";

const typeLabels: Record<string, string> = {
  quick_qa: "Tra cứu nhanh",
  scenario: "Tình huống thuế",
  article: "Bài phân tích",
  report: "Báo cáo chuyên sâu",
  tax_advice: "Thư tư vấn",
};

export default function OutputDetailPage() {
  const [, params] = useRoute("/outputs/:id");
  const id = params?.id;
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const { data: output, isLoading } = useQuery({
    queryKey: ["/api/outputs", id],
    queryFn: async () => {
      const res = await authFetch(`/api/outputs/${id}`);
      return res.json();
    },
    enabled: !!id,
  });

  const handleCopy = () => {
    if (output?.content) {
      navigator.clipboard.writeText(output.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExportPDF = async () => {
    try {
      const res = await authFetch(`/api/outputs/${id}/export/pdf`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `taxadvice-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Lỗi xuất PDF", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (!output) {
    return <p className="text-muted-foreground">Không tìm thấy kết quả</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/outputs">
          <Button variant="ghost" size="sm"><ArrowLeft size={14} className="mr-1" /> Quay lại</Button>
        </Link>
        <Badge variant="outline">{typeLabels[output.type] || output.type}</Badge>
        <span className="text-xs text-muted-foreground">
          {new Date(output.created_at).toLocaleString("vi-VN")}
        </span>
        {output.ai_model && (
          <Badge variant="secondary" className="text-[10px]">{output.ai_model}</Badge>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg" data-testid="text-output-title">{output.title}</CardTitle>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={handleCopy}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span className="ml-1 text-xs">{copied ? "Đã sao chép" : "Sao chép"}</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleExportPDF}>
                <Download size={14} />
                <span className="ml-1 text-xs">PDF</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {output.question && (
            <div className="mb-4 p-3 bg-muted/50 rounded-md">
              <p className="text-xs font-medium text-muted-foreground mb-1">Câu hỏi / Tình huống:</p>
              <p className="text-sm">{output.question}</p>
            </div>
          )}

          {output.content ? (
            <MarkdownRenderer content={output.content} />
          ) : output.status === "processing" ? (
            <p className="text-sm text-muted-foreground animate-pulse">Đang xử lý trong nền...</p>
          ) : (
            <p className="text-sm text-muted-foreground">Không có nội dung</p>
          )}

          {/* Citations */}
          {output.citations && (output.citations as Citation[]).length > 0 && (
            <div className="mt-4 pt-3 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-2">Văn bản tham chiếu:</p>
              <div className="space-y-1">
                {(output.citations as Citation[]).map((c: Citation, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <Badge variant="outline" className="text-[10px] shrink-0">{c.so_hieu}</Badge>
                    {c.article_ref && <span className="text-muted-foreground">{c.article_ref}</span>}
                    {c.excerpt && <span className="text-muted-foreground/70 truncate">{c.excerpt}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
