import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Download, Copy, Check, Database, Globe, ExternalLink } from "lucide-react";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { SacThueSelect } from "@/components/sac-thue-select";
import { AIModelSelect } from "@/components/ai-model-select";
import { StyleReferences } from "@/components/style-references";
import { streamFetch, authFetch } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Output, Citation } from "@shared/schema";

interface AIFeaturePageProps {
  type: "quick_qa" | "scenario" | "article" | "tax_advice" | "press_article";
  title: string;
  description: string;
  placeholder: string;
  apiEndpoint: string;
  inputLabel: string;
  inputField: string;
  showClientFields?: boolean;
  showStyleRefs?: boolean;
}

export default function AIFeaturePage({
  type, title, description, placeholder, apiEndpoint, inputLabel, inputField, showClientFields, showStyleRefs
}: AIFeaturePageProps) {
  const [input, setInput] = useState("");
  const [clientName, setClientName] = useState("");
  const [companyName, setCompanyName] = useState("");
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
  const [hasGammaKey, setHasGammaKey] = useState<boolean | null>(null);
  const [numCards, setNumCards] = useState(10);
  const [gammaStatus, setGammaStatus] = useState<string | null>(null);
  const [gammaUrl, setGammaUrl] = useState<string | null>(null);
  const [gammaPptxUrl, setGammaPptxUrl] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/health").then(r => r.json()).then(data => {
      setHasGammaKey(!!data?.env_check?.GAMMA_API_KEY);
    }).catch(() => setHasGammaKey(false));
  }, []);

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
          return prev + Math.random() * 4;
        });
      }, 800);
      return () => clearInterval(interval);
    } else if (output) {
      setProgress(100);
      setTimeout(() => setProgress(0), 2000);
    }
  }, [streaming, output]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || streaming) return;

    setContent("");
    setOutput(null);
    setError("");
    setSources([]);
    setStreaming(true);
    setGammaStatus(null);
    setGammaUrl(null);
    setGammaPptxUrl(null);

    const body: any = {
      [inputField]: input,
      sac_thue: sacThue.length > 0 ? sacThue : undefined,
      ai_model: aiModel,
      style_references: styleRefs.length > 0 ? styleRefs : undefined,
    };
    if (showClientFields) {
      if (clientName) body.client_name = clientName;
      if (companyName) body.company_name = companyName;
    }

    streamFetch(
      apiEndpoint,
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

  const handleStartGamma = async () => {
    if (!output) return;
    setGammaStatus("processing");
    try {
      const res = await authFetch(`/api/outputs/${output.id}/gamma`, {
        method: "POST",
        body: JSON.stringify({ numCards }),
      });
      const data = await res.json();
      if (data.generationId) {
        toast({ title: "Đang tạo Gamma Slide..." });
        // Poll for status
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await authFetch(`/api/outputs/${output.id}/gamma/status`);
            const statusData = await statusRes.json();
            if (statusData.status === "completed") {
              clearInterval(pollInterval);
              setGammaStatus("completed");
              setGammaUrl(statusData.gammaUrl || null);
              setGammaPptxUrl(statusData.pptxUrl || null);
              toast({ title: "Gamma Slide đã sẵn sàng!" });
            } else if (statusData.status === "failed") {
              clearInterval(pollInterval);
              setGammaStatus("failed");
              toast({ title: "Tạo Gamma Slide thất bại", variant: "destructive" });
            }
          } catch {}
        }, 5000);
      }
    } catch (err: any) {
      setGammaStatus("failed");
      toast({ title: "Lỗi tạo Gamma Slide", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold" data-testid="text-page-title">{title}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>

      {/* Input form */}
      <Card>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            {showClientFields && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Tên khách hàng (tùy chọn)</Label>
                  <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Ông/Bà ..." className="text-sm" data-testid="input-client-name" />
                </div>
                <div>
                  <Label className="text-xs">Tên công ty (tùy chọn)</Label>
                  <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Công ty ..." className="text-sm" data-testid="input-company-name" />
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs">{inputLabel}</Label>
              <Textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={placeholder}
                rows={4}
                className="text-sm resize-y"
                data-testid="input-question"
              />
            </div>

            {showStyleRefs && (
              <StyleReferences value={styleRefs} onChange={setStyleRefs} />
            )}

            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs mb-1 block">Lọc theo sắc thuế (tùy chọn)</Label>
                <SacThueSelect value={sacThue} onChange={setSacThue} />
              </div>
              <div>
                <Label className="text-xs mb-1 block">AI Model</Label>
                <AIModelSelect value={aiModel} onChange={setAiModel} />
              </div>
              <Button type="submit" disabled={streaming || !input.trim()} data-testid="btn-submit">
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
            <span>Đang xử lý...</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
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
                <MarkdownRenderer content={content} streaming={streaming} citations={output?.citations as any[]} />
              </div>
            )}



            {/* Gamma section */}
            {hasGammaKey && output && !streaming && (
              <div className="mt-4 pt-3 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-2">Gamma Slides</p>
                {!gammaStatus ? (
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
                    <Button variant="outline" size="sm" onClick={handleStartGamma}>
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
                    <Button variant="outline" size="sm" onClick={() => setGammaStatus(null)}>
                      Thử lại
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
