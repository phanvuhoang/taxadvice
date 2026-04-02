import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Plus, Trash2, ChevronDown, ChevronRight,
  Download, Copy, Check, ArrowUp, ArrowDown, RotateCcw,
  ExternalLink, Database, Globe
} from "lucide-react";
import { AIModelSelect } from "@/components/ai-model-select";
import { SacThueSelect } from "@/components/sac-thue-select";
import { StyleReferences } from "@/components/style-references";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { authFetch } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import type { ReportFrame, Output } from "@shared/schema";

interface FrameTopic {
  id: string;
  name: string;
  enabled: boolean;
  subTopics: string[];
  editing?: boolean;
}

export default function ReportPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [industry, setIndustry] = useState("");
  const [company, setCompany] = useState("");
  const [aiModel, setAiModel] = useState("deepseek");
  const [sacThue, setSacThue] = useState<string[]>([]);
  const [styleRefs, setStyleRefs] = useState<string[]>([]);
  const [topics, setTopics] = useState<FrameTopic[]>([]);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [newSubTopics, setNewSubTopics] = useState<Record<string, string>>({});
  const [newTopicName, setNewTopicName] = useState("");
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editingTopicName, setEditingTopicName] = useState("");
  const [activeReportId, setActiveReportId] = useState<number | null>(null);
  const [defaultTopics, setDefaultTopics] = useState<FrameTopic[]>([]);
  const [copied, setCopied] = useState(false);
  const [hasGammaKey, setHasGammaKey] = useState(false);
  const [numCards, setNumCards] = useState(15);
  const [gammaStatus, setGammaStatus] = useState<string | null>(null);
  const [gammaUrl, setGammaUrl] = useState<string | null>(null);
  const [gammaPptxUrl, setGammaPptxUrl] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/health").then(r => r.json()).then(data => {
      setHasGammaKey(!!data?.env_check?.GAMMA_API_KEY);
    }).catch(() => {});
  }, []);

  // Fetch frame when industry or company changes
  const fetchFrame = useCallback(async () => {
    if (!industry && !company) {
      setTopics([]);
      setDefaultTopics([]);
      return;
    }
    try {
      let type = "industry";
      let params = new URLSearchParams();
      if (industry && company) {
        type = "both";
        params.set("industry", industry);
        params.set("company", company);
      } else if (industry) {
        type = "industry";
        params.set("industry", industry);
      } else {
        type = "company";
        params.set("company", company);
      }
      const res = await authFetch(`/api/report-frames/${type}?${params.toString()}`);
      const data = await res.json();
      const frame: ReportFrame[] = data.frame || [];
      const mapped: FrameTopic[] = frame.map(f => ({
        id: f.id,
        name: f.name,
        enabled: f.enabled,
        subTopics: [...f.subTopics],
      }));
      setTopics(mapped);
      setDefaultTopics(mapped.map(t => ({ ...t, subTopics: [...t.subTopics] })));
    } catch (err) {
      // silent fail
    }
  }, [industry, company]);

  // Debounce frame fetch
  useEffect(() => {
    const timer = setTimeout(fetchFrame, 600);
    return () => clearTimeout(timer);
  }, [fetchFrame]);

  // Get report status
  const { data: reportData, refetch: refetchReport } = useQuery({
    queryKey: ["/api/ai/report", activeReportId, "status"],
    queryFn: async () => {
      if (!activeReportId) return null;
      const res = await authFetch(`/api/ai/report/${activeReportId}/status`);
      return res.json();
    },
    enabled: !!activeReportId,
    refetchInterval: (query) => {
      const data = query.state.data as any;
      return data?.output?.status === "processing" ? 3000 : false;
    },
  });

  // Create report
  const createReport = useMutation({
    mutationFn: async () => {
      const enabledTopics = topics.filter(t => t.enabled).map(t => ({
        id: t.id,
        name: t.name,
        enabled: t.enabled,
        subTopics: t.subTopics,
        parentId: null,
      }));
      const res = await authFetch("/api/ai/report", {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          industry,
          company,
          ai_model: aiModel,
          topics: enabledTopics.length > 0 ? enabledTopics : undefined,
          sac_thue: sacThue.length > 0 ? sacThue : undefined,
          style_references: styleRefs.length > 0 ? styleRefs : undefined,
        }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      setActiveReportId(data.output.id);
      toast({ title: "Báo cáo đang được tạo trong nền" });
    },
    onError: (err: any) => {
      toast({ title: "Lỗi tạo báo cáo", description: err.message, variant: "destructive" });
    },
  });

  const handleToggleTopic = (id: string) => {
    setTopics(prev => prev.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t));
  };

  const handleEditTopic = (id: string, name: string) => {
    setEditingTopicId(id);
    setEditingTopicName(name);
  };

  const handleSaveEdit = (id: string) => {
    if (editingTopicName.trim()) {
      setTopics(prev => prev.map(t => t.id === id ? { ...t, name: editingTopicName.trim() } : t));
    }
    setEditingTopicId(null);
    setEditingTopicName("");
  };

  const handleMoveTopic = (id: string, dir: "up" | "down") => {
    setTopics(prev => {
      const idx = prev.findIndex(t => t.id === id);
      if (idx < 0) return prev;
      if (dir === "up" && idx === 0) return prev;
      if (dir === "down" && idx === prev.length - 1) return prev;
      const next = [...prev];
      const swap = dir === "up" ? idx - 1 : idx + 1;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  };

  const handleDeleteTopic = (id: string) => {
    setTopics(prev => prev.filter(t => t.id !== id));
  };

  const handleAddSubTopic = (topicId: string) => {
    const val = (newSubTopics[topicId] || "").trim();
    if (!val) return;
    setTopics(prev => prev.map(t => t.id === topicId ? { ...t, subTopics: [...t.subTopics, val] } : t));
    setNewSubTopics(prev => ({ ...prev, [topicId]: "" }));
  };

  const handleRemoveSubTopic = (topicId: string, idx: number) => {
    setTopics(prev => prev.map(t => t.id === topicId ? { ...t, subTopics: t.subTopics.filter((_, i) => i !== idx) } : t));
  };

  const handleAddTopic = () => {
    if (!newTopicName.trim()) return;
    const newId = `T${Date.now()}`;
    setTopics(prev => [...prev, { id: newId, name: newTopicName.trim(), enabled: true, subTopics: [] }]);
    setNewTopicName("");
  };

  const handleResetTopics = () => {
    setTopics(defaultTopics.map(t => ({ ...t, subTopics: [...t.subTopics] })));
  };

  const handleCopy = () => {
    const output: Output | null = reportData?.output || null;
    if (output?.content) {
      navigator.clipboard.writeText(output.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExportWord = async () => {
    if (!activeReportId) return;
    try {
      const res = await authFetch(`/api/outputs/${activeReportId}/export/docx`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `taxadvice-report-${activeReportId}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Lỗi xuất Word", variant: "destructive" });
    }
  };

  const handleStartGamma = async () => {
    if (!activeReportId) return;
    setGammaStatus("processing");
    try {
      const res = await authFetch(`/api/outputs/${activeReportId}/gamma`, {
        method: "POST",
        body: JSON.stringify({ numCards }),
      });
      const data = await res.json();
      if (data.generationId) {
        toast({ title: "Đang tạo Gamma Slide..." });
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await authFetch(`/api/outputs/${activeReportId}/gamma/status`);
            const statusData = await statusRes.json();
            if (statusData.status === "completed") {
              clearInterval(pollInterval);
              setGammaStatus("completed");
              setGammaUrl(statusData.gammaUrl || null);
              setGammaPptxUrl(statusData.pptxUrl || null);
            } else if (statusData.status === "failed") {
              clearInterval(pollInterval);
              setGammaStatus("failed");
            }
          } catch {}
        }, 5000);
      }
    } catch (err: any) {
      setGammaStatus("failed");
      toast({ title: "Lỗi tạo Gamma Slide", variant: "destructive" });
    }
  };

  const output: Output | null = reportData?.output || null;
  const reportTopics = reportData?.topics || [];
  const isProcessing = output?.status === "processing";
  const isCompleted = output?.status === "completed";

  // Calculate progress
  const completedTopics = reportTopics.filter((t: any) => t.status === "completed").length;
  const totalTopics = reportTopics.length;
  const processingTopic = reportTopics.find((t: any) => t.status === "processing");
  const progress = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Báo cáo phân tích tác động thuế</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Tạo báo cáo chuyên sâu theo ngành hoặc theo công ty, có thể tùy chỉnh topics
        </p>
      </div>

      {!activeReportId ? (
        <Card>
          <CardContent className="pt-4">
            <form onSubmit={(e) => { e.preventDefault(); createReport.mutate(); }} className="space-y-4">
              {/* Title */}
              <div>
                <Label className="text-xs">Tiêu đề báo cáo</Label>
                <Input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="VD: Phân tích tác động thuế ngành Bất động sản 2026"
                  required
                  data-testid="input-report-title"
                />
              </div>

              {/* Description */}
              <div>
                <Label className="text-xs">Mô tả (tùy chọn)</Label>
                <Textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Mô tả phạm vi và yêu cầu của báo cáo..."
                  rows={2}
                  className="text-sm"
                />
              </div>

              {/* Industry + Company */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Ngành (tùy chọn)</Label>
                  <Input
                    value={industry}
                    onChange={e => setIndustry(e.target.value)}
                    placeholder="VD: Bất động sản"
                  />
                </div>
                <div>
                  <Label className="text-xs">Công ty (tùy chọn)</Label>
                  <Input
                    value={company}
                    onChange={e => setCompany(e.target.value)}
                    placeholder="VD: Công ty ABC"
                  />
                </div>
              </div>

              {/* Topic editor */}
              {topics.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Danh sách chủ đề phân tích</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={handleResetTopics}
                    >
                      <RotateCcw size={12} className="mr-1" /> Khôi phục mặc định
                    </Button>
                  </div>

                  <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
                    {topics.map((topic, idx) => (
                      <div key={topic.id} className="border rounded-md bg-card">
                        {/* Topic row */}
                        <div className="flex items-center gap-2 px-2.5 py-2">
                          <input
                            type="checkbox"
                            checked={topic.enabled}
                            onChange={() => handleToggleTopic(topic.id)}
                            className="rounded border-border"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const next = new Set(expandedTopics);
                              if (next.has(topic.id)) next.delete(topic.id); else next.add(topic.id);
                              setExpandedTopics(next);
                            }}
                            className="p-0.5 text-muted-foreground"
                          >
                            {expandedTopics.has(topic.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>

                          {editingTopicId === topic.id ? (
                            <input
                              className="flex-1 text-sm border rounded px-2 py-1 bg-background"
                              value={editingTopicName}
                              autoFocus
                              onChange={e => setEditingTopicName(e.target.value)}
                              onBlur={() => handleSaveEdit(topic.id)}
                              onKeyDown={e => e.key === "Enter" && handleSaveEdit(topic.id)}
                            />
                          ) : (
                            <span
                              className="text-sm flex-1 cursor-pointer hover:text-primary"
                              onDoubleClick={() => handleEditTopic(topic.id, topic.name)}
                              title="Nhấp đúp để chỉnh sửa"
                            >
                              {topic.name}
                            </span>
                          )}

                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleMoveTopic(topic.id, "up")}
                              disabled={idx === 0}
                              className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                            >
                              <ArrowUp size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveTopic(topic.id, "down")}
                              disabled={idx === topics.length - 1}
                              className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                            >
                              <ArrowDown size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTopic(topic.id)}
                              className="p-1 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Sub-topics */}
                        {expandedTopics.has(topic.id) && (
                          <div className="px-4 pb-2.5 border-t bg-muted/20 space-y-1.5">
                            {topic.subTopics.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-2">
                                {topic.subTopics.map((st, stIdx) => (
                                  <span
                                    key={stIdx}
                                    className="flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs"
                                  >
                                    {st}
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveSubTopic(topic.id, stIdx)}
                                      className="hover:text-destructive"
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="flex gap-1.5 pt-1">
                              <Input
                                value={newSubTopics[topic.id] || ""}
                                onChange={e => setNewSubTopics(prev => ({ ...prev, [topic.id]: e.target.value }))}
                                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleAddSubTopic(topic.id))}
                                placeholder="Thêm mục nhỏ..."
                                className="h-7 text-xs"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs px-2"
                                onClick={() => handleAddSubTopic(topic.id)}
                                disabled={!newSubTopics[topic.id]?.trim()}
                              >
                                <Plus size={10} />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Add new topic */}
                  <div className="flex gap-2 pt-1">
                    <Input
                      value={newTopicName}
                      onChange={e => setNewTopicName(e.target.value)}
                      placeholder="Thêm chủ đề mới..."
                      className="text-sm h-8"
                      onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleAddTopic())}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddTopic}
                      disabled={!newTopicName.trim()}
                    >
                      <Plus size={14} className="mr-1" /> Thêm mục
                    </Button>
                  </div>
                </div>
              )}

              {/* Style references */}
              <StyleReferences value={styleRefs} onChange={setStyleRefs} />

              {/* Sac thue + Model + Submit */}
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-xs mb-1 block">Lọc theo sắc thuế (tùy chọn)</Label>
                  <SacThueSelect value={sacThue} onChange={setSacThue} />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">AI Model</Label>
                  <AIModelSelect value={aiModel} onChange={setAiModel} />
                </div>
                <Button
                  type="submit"
                  disabled={createReport.isPending || !title.trim()}
                  data-testid="btn-create-report"
                >
                  {createReport.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                  Tạo báo cáo
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Report status card */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{output?.title || title}</CardTitle>
                <Badge variant={isCompleted ? "default" : isProcessing ? "secondary" : "destructive"}>
                  {isCompleted ? "Hoàn thành" : isProcessing ? "Đang xử lý..." : "Lỗi"}
                </Badge>
              </div>
            </CardHeader>
            {isProcessing && totalTopics > 0 && (
              <CardContent className="pt-0 pb-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {processingTopic ? `Đang tạo: ${processingTopic.name}` : "Đang xử lý..."}
                    </span>
                    <span>{completedTopics}/{totalTopics} ({progress}%)</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Full report content */}
          {output?.content && isCompleted && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base">Nội dung báo cáo</CardTitle>
                  <div className="flex gap-1 flex-wrap">
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
                <MarkdownRenderer content={output.content} />

                {/* Gamma section */}
                {hasGammaKey && (
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
                            onChange={e => setNumCards(parseInt(e.target.value) || 15)}
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

          <Button variant="outline" onClick={() => { setActiveReportId(null); setTopics([]); setDefaultTopics([]); }}>
            Tạo báo cáo mới
          </Button>
        </>
      )}
    </div>
  );
}
