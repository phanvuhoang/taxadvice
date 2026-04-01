import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, FileText, Download, Eye } from "lucide-react";
import { authFetch } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

const typeLabels: Record<string, string> = {
  quick_qa: "Tra cứu nhanh",
  scenario: "Tình huống thuế",
  article: "Bài phân tích",
  report: "Báo cáo chuyên sâu",
  tax_advice: "Thư tư vấn",
};

export default function OutputsPage() {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["/api/outputs", typeFilter, page],
    queryFn: async () => {
      let url = `/api/outputs?limit=20&offset=${page * 20}`;
      if (typeFilter !== "all") url += `&type=${typeFilter}`;
      const res = await authFetch(url);
      return res.json();
    },
  });

  const deleteOutput = useMutation({
    mutationFn: async (id: number) => {
      await authFetch(`/api/outputs/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Đã xóa" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Kết quả đã lưu</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Tất cả kết quả tra cứu, phân tích và tư vấn</p>
        </div>
        <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[180px]" data-testid="select-type-filter">
            <SelectValue placeholder="Lọc theo loại" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            {Object.entries(typeLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="space-y-2">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : data?.outputs?.length > 0 ? (
            <div className="space-y-1">
              {data.outputs.map((o: any) => (
                <div key={o.id} className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent/50 transition-colors group">
                  <FileText size={14} className="text-muted-foreground shrink-0" />
                  <Badge variant="outline" className="text-[10px] font-normal shrink-0">
                    {typeLabels[o.type] || o.type}
                  </Badge>
                  <Link href={`/outputs/${o.id}`}>
                    <span className="text-sm hover:text-primary cursor-pointer truncate" data-testid={`output-link-${o.id}`}>{o.title}</span>
                  </Link>
                  <span className="text-[10px] text-muted-foreground shrink-0 ml-auto">
                    {new Date(o.created_at).toLocaleDateString("vi-VN")}
                  </span>
                  {o.status === "processing" && (
                    <Badge variant="secondary" className="text-[10px] animate-pulse">Đang xử lý</Badge>
                  )}
                  <Button
                    variant="ghost" size="sm" className="h-7 px-2 opacity-0 group-hover:opacity-100 text-destructive"
                    onClick={() => deleteOutput.mutate(o.id)}
                    data-testid={`btn-delete-${o.id}`}
                  >
                    <Trash2 size={12} />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Chưa có kết quả nào</p>
          )}

          {/* Pagination */}
          {data?.total > 20 && (
            <div className="flex justify-center gap-2 mt-4 pt-3 border-t">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                Trước
              </Button>
              <span className="text-sm text-muted-foreground py-1.5">
                Trang {page + 1} / {Math.ceil(data.total / 20)}
              </span>
              <Button variant="outline" size="sm" disabled={(page + 1) * 20 >= data.total} onClick={() => setPage(p => p + 1)}>
                Tiếp
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
