import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Play, ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import { AIModelSelect } from "@/components/ai-model-select";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { authFetch } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { ReportTopic, Output } from "@shared/schema";

export default function ReportPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [industry, setIndustry] = useState("");
  const [company, setCompany] = useState("");
  const [aiModel, setAiModel] = useState("deepseek");
  const [activeReportId, setActiveReportId] = useState<number | null>(null);
  const [newTopicName, setNewTopicName] = useState("");
  const [expandedTopics, setExpandedTopics] = useState<Set<number>>(new Set());
  const { toast } = useToast();

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
      const res = await authFetch("/api/ai/report", {
        method: "POST",
        body: JSON.stringify({ title, description, industry, company, ai_model: aiModel }),
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

  // Add topic
  const addTopic = useMutation({
    mutationFn: async () => {
      if (!activeReportId || !newTopicName.trim()) return;
      const res = await authFetch(`/api/reports/${activeReportId}/topics`, {
        method: "POST",
        body: JSON.stringify({ name: newTopicName }),
      });
      return res.json();
    },
    onSuccess: () => {
      setNewTopicName("");
      refetchReport();
    },
  });

  // Delete topic
  const deleteTopic = useMutation({
    mutationFn: async (topicId: number) => {
      await authFetch(`/api/reports/${activeReportId}/topics/${topicId}`, { method: "DELETE" });
    },
    onSuccess: () => refetchReport(),
  });

  // Generate topic content
  const generateTopic = useMutation({
    mutationFn: async (topicId: number) => {
      const res = await authFetch(`/api/reports/${activeReportId}/topics/${topicId}/generate`, {
        method: "POST",
      });
      return res.json();
    },
    onSuccess: () => refetchReport(),
    onError: (err: any) => {
      toast({ title: "Lỗi tạo nội dung", description: err.message, variant: "destructive" });
    },
  });

  const toggleTopic = (id: number) => {
    const next = new Set(expandedTopics);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedTopics(next);
  };

  const topics: ReportTopic[] = reportData?.topics || [];
  const output: Output | null = reportData?.output || null;

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
            <form onSubmit={(e) => { e.preventDefault(); createReport.mutate(); }} className="space-y-3">
              <div>
                <Label className="text-xs">Tiêu đề báo cáo</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="VD: Phân tích tác động thuế ngành Bất động sản 2026" required data-testid="input-report-title" />
              </div>
              <div>
                <Label className="text-xs">Mô tả (tùy chọn)</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Mô tả phạm vi và yêu cầu của báo cáo..." rows={3} className="text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Ngành (tùy chọn)</Label>
                  <Input value={industry} onChange={e => setIndustry(e.target.value)} placeholder="VD: Bất động sản" />
                </div>
                <div>
                  <Label className="text-xs">Công ty (tùy chọn)</Label>
                  <Input value={company} onChange={e => setCompany(e.target.value)} placeholder="VD: Công ty ABC" />
                </div>
              </div>
              <div className="flex items-end gap-3">
                <div>
                  <Label className="text-xs">AI Model</Label>
                  <AIModelSelect value={aiModel} onChange={setAiModel} />
                </div>
                <Button type="submit" disabled={createReport.isPending || !title.trim()} data-testid="btn-create-report">
                  {createReport.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                  Tạo báo cáo
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Report status */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{output?.title || title}</CardTitle>
                <Badge variant={output?.status === "completed" ? "default" : output?.status === "processing" ? "secondary" : "destructive"}>
                  {output?.status === "completed" ? "Hoàn thành" : output?.status === "processing" ? "Đang xử lý..." : "Lỗi"}
                </Badge>
              </div>
            </CardHeader>
          </Card>

          {/* Topic management */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Quản lý chủ đề phân tích</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {topics.map((topic) => (
                <div key={topic.id} className="border rounded-md">
                  <div className="flex items-center gap-2 p-2.5">
                    <button onClick={() => toggleTopic(topic.id)} className="p-0.5">
                      {expandedTopics.has(topic.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <span className="text-sm flex-1">{topic.name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {topic.status === "completed" ? "Xong" : topic.status === "processing" ? "Đang tạo..." : "Chờ"}
                    </Badge>
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => generateTopic.mutate(topic.id)}
                      disabled={generateTopic.isPending}>
                      <Play size={12} />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={() => deleteTopic.mutate(topic.id)}>
                      <Trash2 size={12} />
                    </Button>
                  </div>
                  {expandedTopics.has(topic.id) && topic.content && (
                    <div className="px-4 pb-3 border-t bg-muted/30">
                      <MarkdownRenderer content={topic.content} className="text-sm" />
                    </div>
                  )}
                </div>
              ))}

              {/* Add topic */}
              <div className="flex gap-2 pt-2">
                <Input value={newTopicName} onChange={e => setNewTopicName(e.target.value)}
                  placeholder="Thêm chủ đề mới..." className="text-sm" data-testid="input-new-topic"
                  onKeyDown={e => e.key === "Enter" && addTopic.mutate()}
                />
                <Button variant="outline" size="sm" onClick={() => addTopic.mutate()} disabled={!newTopicName.trim()}>
                  <Plus size={14} className="mr-1" /> Thêm
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Full report content */}
          {output?.content && output.status === "completed" && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Nội dung báo cáo</CardTitle>
              </CardHeader>
              <CardContent>
                <MarkdownRenderer content={output.content} />
              </CardContent>
            </Card>
          )}

          <Button variant="outline" onClick={() => setActiveReportId(null)}>
            Tạo báo cáo mới
          </Button>
        </>
      )}
    </div>
  );
}
