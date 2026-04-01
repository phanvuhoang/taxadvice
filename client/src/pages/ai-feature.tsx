import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Download, Copy, Check } from "lucide-react";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { SacThueSelect } from "@/components/sac-thue-select";
import { AIModelSelect } from "@/components/ai-model-select";
import { streamFetch, authFetch } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import type { Output, Citation } from "@shared/schema";

interface AIFeaturePageProps {
  type: "quick_qa" | "scenario" | "article" | "tax_advice";
  title: string;
  description: string;
  placeholder: string;
  apiEndpoint: string;
  inputLabel: string;
  inputField: string;
  showClientFields?: boolean;
}

export default function AIFeaturePage({
  type, title, description, placeholder, apiEndpoint, inputLabel, inputField, showClientFields
}: AIFeaturePageProps) {
  const [input, setInput] = useState("");
  const [clientName, setClientName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [sacThue, setSacThue] = useState<string[]>([]);
  const [aiModel, setAiModel] = useState<string>("deepseek");
  const [streaming, setStreaming] = useState(false);
  const [content, setContent] = useState("");
  const [output, setOutput] = useState<Output | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (contentRef.current && streaming) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content, streaming]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || streaming) return;

    setContent("");
    setOutput(null);
    setError("");
    setStreaming(true);

    const body: any = {
      [inputField]: input,
      sac_thue: sacThue.length > 0 ? sacThue : undefined,
      ai_model: aiModel,
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
      }
    );
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportPDF = async () => {
    if (!output) return;
    try {
      const res = await authFetch(`/api/outputs/${output.id}/export/pdf`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `taxadvice-${output.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Lỗi xuất PDF", variant: "destructive" });
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

      {/* Output */}
      {(content || error) && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">Kết quả</CardTitle>
              <div className="flex gap-1">
                {content && (
                  <Button variant="ghost" size="sm" onClick={handleCopy} data-testid="btn-copy">
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    <span className="ml-1 text-xs">{copied ? "Đã sao chép" : "Sao chép"}</span>
                  </Button>
                )}
                {output && (
                  <Button variant="ghost" size="sm" onClick={handleExportPDF} data-testid="btn-export-pdf">
                    <Download size={14} />
                    <span className="ml-1 text-xs">PDF</span>
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
