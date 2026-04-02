import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Download, Copy, Check, Moon, Sun, Minus, Plus, Loader2, ExternalLink, Database, Globe } from "lucide-react";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { authFetch } from "@/lib/auth";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import type { Citation } from "@shared/schema";

const typeLabels: Record<string, string> = {
  quick_qa: "Tra cứu nhanh",
  scenario: "Tình huống thuế",
  article: "Bài phân tích",
  press_article: "Bài viết báo",
  report: "Báo cáo chuyên sâu",
  tax_advice: "Thư tư vấn",
};

export default function OutputDetailPage() {
  const [, params] = useRoute("/outputs/:id");
  const id = params?.id;
  const [copied, setCopied] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [isDark, setIsDark] = useState(false);
  const [numCards, setNumCards] = useState(10);
  const [hasGammaKey, setHasGammaKey] = useState<boolean | null>(null);
  const { toast } = useToast();
  const queryClientHook = useQueryClient();

  // Check if GAMMA_API_KEY is configured
  useEffect(() => {
    fetch("/api/health").then(r => r.json()).then(data => {
      setHasGammaKey(!!data?.env_check?.GAMMA_API_KEY);
    }).catch(() => setHasGammaKey(false));
  }, []);

  // Detect initial dark mode
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const { data: output, isLoading } = useQuery({
    queryKey: ["/api/outputs", id],
    queryFn: async () => {
      const res = await authFetch(`/api/outputs/${id}`);
      return res.json();
    },
    enabled: !!id,
  });

  // Poll if gamma is generating
  useQuery({
    queryKey: ["/api/outputs", id, "gamma-status"],
    queryFn: async () => {
      const res = await authFetch(`/api/outputs/${id}/gamma/status`);
      const data = await res.json();
      if (data.status === "completed" || data.status === "failed") {
        queryClientHook.invalidateQueries({ queryKey: ["/api/outputs", id] });
      }
      return data;
    },
    enabled: !!id && output?.metadata?.gamma_status === "processing",
    refetchInterval: 5000,
  });

  const startGamma = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`/api/outputs/${id}/gamma`, {
        method: "POST",
        body: JSON.stringify({ numCards }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClientHook.invalidateQueries({ queryKey: ["/api/outputs", id] });
      toast({ title: "Đang tạo Gamma Slide..." });
    },
    onError: (err: any) => {
      toast({ title: "Lỗi tạo Gamma Slide", description: err.message, variant: "destructive" });
    },
  });

  const handleCopy = () => {
    if (output?.content) {
      navigator.clipboard.writeText(output.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExportWord = async () => {
    try {
      const res = await authFetch(`/api/outputs/${id}/export/docx`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `taxadvice-${id}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Lỗi xuất Word", variant: "destructive" });
    }
  };

  const toggleDarkMode = () => {
    document.documentElement.classList.toggle("dark");
    setIsDark(prev => !prev);
  };

  const adjustFontSize = (delta: number) => {
    setFontSize(prev => Math.min(20, Math.max(12, prev + delta)));
  };

  const sources: string[] = output?.metadata?.sources || [];

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

  const gammaStatus = output.metadata?.gamma_status;
  const gammaUrl = output.metadata?.gamma_url;
  const gammaPptxUrl = output.metadata?.gamma_pptx_url;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
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
        {sources.includes("corpus") && (
          <Badge variant="outline" className="text-[10px] gap-1 text-emerald-600 border-emerald-200 dark:border-emerald-800">
            <Database size={10} /> Cơ sở dữ liệu
          </Badge>
        )}
        {sources.includes("internet") && (
          <Badge variant="outline" className="text-[10px] gap-1 text-blue-600 border-blue-200 dark:border-blue-800">
            <Globe size={10} /> Internet
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-lg" data-testid="text-output-title">{output.title}</CardTitle>
            <div className="flex gap-1 flex-wrap items-center">
              {/* Floating toolbar */}
              <div className="flex items-center gap-1 border rounded-md px-2 py-1 bg-muted/30">
                <button
                  onClick={() => adjustFontSize(-1)}
                  className="text-xs font-bold text-muted-foreground hover:text-foreground px-1 transition-colors"
                  title="Giảm cỡ chữ"
                  disabled={fontSize <= 12}
                >
                  A-
                </button>
                <span className="text-xs text-muted-foreground w-7 text-center">{fontSize}px</span>
                <button
                  onClick={() => adjustFontSize(1)}
                  className="text-sm font-bold text-muted-foreground hover:text-foreground px-1 transition-colors"
                  title="Tăng cỡ chữ"
                  disabled={fontSize >= 20}
                >
                  A+
                </button>
              </div>
              <Button variant="ghost" size="sm" onClick={toggleDarkMode} title={isDark ? "Chế độ sáng" : "Chế độ tối"}>
                {isDark ? <Sun size={14} /> : <Moon size={14} />}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleCopy}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span className="ml-1 text-xs">{copied ? "Đã sao chép" : "Sao chép"}</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleExportWord}>
                <Download size={14} />
                <span className="ml-1 text-xs">Xuất Word</span>
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
            <div className="markdown-content" style={{ fontSize: `${fontSize}px` }}>
              <MarkdownRenderer content={output.content} />
            </div>
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

          {/* Gamma slide section */}
          {hasGammaKey && output.content && output.status === "completed" && (
            <div className="mt-4 pt-3 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-2">Gamma Slides</p>
              {!gammaStatus || gammaStatus === "none" ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Số slide:</span>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={numCards}
                      onChange={e => setNumCards(parseInt(e.target.value) || 10)}
                      className="w-14 text-xs border rounded px-2 py-1 bg-background"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startGamma.mutate()}
                    disabled={startGamma.isPending}
                  >
                    {startGamma.isPending ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
                    Tạo Gamma Slide
                  </Button>
                </div>
              ) : gammaStatus === "processing" ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 size={12} className="animate-spin" />
                  Đang tạo slides...
                </div>
              ) : gammaStatus === "completed" && gammaUrl ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="outline" size="sm" asChild>
                    <a href={gammaUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink size={12} className="mr-1" /> Xem Gamma Slide
                    </a>
                  </Button>
                  {gammaPptxUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={gammaPptxUrl} target="_blank" rel="noopener noreferrer">
                        <Download size={12} className="mr-1" /> Download PPTX
                      </a>
                    </Button>
                  )}
                </div>
              ) : gammaStatus === "failed" ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-destructive">Tạo slide thất bại</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startGamma.mutate()}
                  >
                    Thử lại
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
