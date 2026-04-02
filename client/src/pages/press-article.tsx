import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Download, Copy, Check, Database, Globe } from "lucide-react";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { SacThueSelect } from "@/components/sac-thue-select";
import { AIModelSelect } from "@/components/ai-model-select";
import { StyleReferences } from "@/components/style-references";
import { streamFetch, authFetch } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import type { Output, Citation } from "@shared/schema";

export default function PressArticlePage() {
  const [topic, setTopic] = useState("");
  const [sacThue, setSacThue] = useState<string[]>([]);
  const [aiModel, setAiModel] = useState<string>("deepseek");
  const [styleRefs, setStyleRefs] = useState<string[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [content, setContent] = useState("");
  const [output, setOutput] = useState<Output | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [sources, setSources] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (contentRef.current && streaming) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content, streaming]);

  // Simulate progress during streaming
  useEffect(() => {
    if (streaming) {
      setProgress(0);
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 5;
        });
      }, 800);
      return () => clearInterval(interval);
    } else if (output) {
      setProgress(100);
    }
  }, [streaming, output]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || streaming) return;

    setContent("");
    setOutput(null);
    setError("");
    setSources([]);
    setStreaming(true);
    setProgress(0);

    const body: any = {
      topic,
      sac_thue: sacThue.length > 0 ? sacThue : undefined,
      ai_model: aiModel,
      style_references: styleRefs.length > 0 ? styleRefs : undefined,
    };

    streamFetch(
      "/api/ai/press-article",
      body,
      (text) => setContent(prev => prev + text),
      (out) => {
        setOutput(out);
        setStreaming(false);
      },
      (msg) => {
        setError(msg);
        setStreaming(false);
      },
      (src) => setSources(src)
    );
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportWord = async () => {
    if (!output) return;
    try {
      const res = await authFetch(`/api/outputs/${output.id}/export/docx`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `taxadvice-${output.id}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Lỗi xuất Word", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold" data-testid="text-page-title">Bài viết báo</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Tạo bài viết có storytelling, ví dụ thực tế, ngôn ngữ dễ hiểu
        </p>
      </div>

      {/* Input form */}
      <Card>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label className="text-xs">Chủ đề bài viết</Label>
              <Textarea
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="Ví dụ: Viết bài báo về những thay đổi quan trọng trong Luật Thuế GTGT 2025 — dùng ngôn ngữ dễ hiểu cho doanh nhân, có ví dụ thực tế và câu chuyện minh họa"
                rows={4}
                className="text-sm resize-y"
                data-testid="input-question"
              />
            </div>

            <StyleReferences value={styleRefs} onChange={setStyleRefs} />

            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs mb-1 block">Lọc theo sắc thuế (tùy chọn)</Label>
                <SacThueSelect value={sacThue} onChange={setSacThue} />
              </div>
              <div>
                <Label className="text-xs mb-1 block">AI Model</Label>
                <AIModelSelect value={aiModel} onChange={setAiModel} />
              </div>
              <Button type="submit" disabled={streaming || !topic.trim()} data-testid="btn-submit">
                {streaming ? (
                  <><Loader2 size={14} className="animate-spin mr-1" /> Đang xử lý...</>
                ) : (
                  <><Send size={14} className="mr-1" /> Gửi</>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Progress bar */}
      {streaming && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Đang tạo bài viết báo...</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full progress-bar-animate transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Output */}
      {(content || error) && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-medium">Kết quả</CardTitle>
                {sources.length > 0 && (
                  <div className="flex gap-1">
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
                )}
              </div>
              <div className="flex gap-1">
                {content && (
                  <Button variant="ghost" size="sm" onClick={handleCopy} data-testid="btn-copy">
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    <span className="ml-1 text-xs">{copied ? "Đã sao chép" : "Sao chép"}</span>
                  </Button>
                )}
                {output && (
                  <Button variant="ghost" size="sm" onClick={handleExportWord} data-testid="btn-export-word">
                    <Download size={14} />
                    <span className="ml-1 text-xs">Word</span>
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : (
              <div ref={contentRef} className="max-h-[600px] overflow-y-auto pr-2">
                <MarkdownRenderer content={content} streaming={streaming} />
              </div>
            )}

            {/* Citations */}
            {output?.citations && (output.citations as Citation[]).length > 0 && (
              <div className="mt-4 pt-3 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-2">Văn bản tham chiếu:</p>
                <div className="flex flex-wrap gap-1.5">
                  {(output.citations as Citation[]).map((c, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] font-normal">
                      {c.so_hieu}{c.article_ref ? ` - ${c.article_ref}` : ""}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
