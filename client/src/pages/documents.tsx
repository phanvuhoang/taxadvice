import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Search, BookOpen, Star } from "lucide-react";
import { authFetch } from "@/lib/auth";
import { SAC_THUE_OPTIONS } from "@shared/schema";

const loaiLabels: Record<string, string> = {
  Luat: "Luật",
  ND: "Nghị định",
  TT: "Thông tư",
  VBHN: "Văn bản hợp nhất",
  QD: "Quyết định",
  NQ: "Nghị quyết",
  Khac: "Khác",
};

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  con_hieu_luc: { label: "Còn hiệu lực", variant: "default" },
  het_hieu_luc: { label: "Hết hiệu lực", variant: "destructive" },
  mot_phan: { label: "Một phần", variant: "secondary" },
};

export default function DocumentsPage() {
  const [search, setSearch] = useState("");
  const [sacThue, setSacThue] = useState("all");
  const [loai, setLoai] = useState("all");
  const [anchorOnly, setAnchorOnly] = useState(false);

  const { data: docs, isLoading } = useQuery({
    queryKey: ["/api/documents", search, sacThue, loai, anchorOnly],
    queryFn: async () => {
      let url = "/api/documents?";
      if (search) url += `search=${encodeURIComponent(search)}&`;
      if (sacThue !== "all") url += `sac_thue=${sacThue}&`;
      if (loai !== "all") url += `loai=${loai}&`;
      if (anchorOnly) url += `anchor_only=true&`;
      const res = await authFetch(url);
      return res.json();
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Văn bản thuế</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {docs?.length ?? "..."} văn bản pháp luật trong cơ sở dữ liệu
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm theo tên, số hiệu..."
            className="pl-8 text-sm"
            data-testid="input-search-docs"
          />
        </div>
        <Select value={sacThue} onValueChange={setSacThue}>
          <SelectTrigger className="w-[160px]" data-testid="select-sac-thue">
            <SelectValue placeholder="Sắc thuế" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả sắc thuế</SelectItem>
            {SAC_THUE_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={loai} onValueChange={setLoai}>
          <SelectTrigger className="w-[140px]" data-testid="select-loai">
            <SelectValue placeholder="Loại VB" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả loại</SelectItem>
            {Object.entries(loaiLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={anchorOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setAnchorOnly(!anchorOnly)}
        >
          <Star size={12} className="mr-1" />
          Anchor
        </Button>
      </div>

      {/* Document list */}
      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="space-y-2">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : docs?.length > 0 ? (
            <div className="space-y-1">
              {docs.map((doc: any) => (
                <div key={doc.id} className="flex items-start gap-3 px-3 py-2.5 rounded-md hover:bg-accent/50 transition-colors">
                  <BookOpen size={14} className="text-muted-foreground mt-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium">{doc.so_hieu}</span>
                      {doc.is_anchor && <Star size={12} className="text-amber-500 fill-amber-500" />}
                      <Badge {...statusLabels[doc.tinh_trang]} className="text-[10px]">
                        {statusLabels[doc.tinh_trang]?.label || doc.tinh_trang}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">{loaiLabels[doc.loai] || doc.loai}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">{doc.ten}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {doc.sac_thue?.map((s: string) => (
                        <Badge key={s} variant="secondary" className="text-[9px] py-0">{s}</Badge>
                      ))}
                      <span className="text-[10px] text-muted-foreground/60">
                        {doc.ngay_ban_hanh ? new Date(doc.ngay_ban_hanh).toLocaleDateString("vi-VN") : ""}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Không tìm thấy văn bản nào</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
