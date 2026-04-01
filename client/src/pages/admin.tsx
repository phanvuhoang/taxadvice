import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Database, Trash2, Shield, RefreshCw, Loader2 } from "lucide-react";
import { authFetch } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

export default function AdminPage() {
  const { toast } = useToast();

  // Users
  const { data: users, isLoading: loadingUsers, refetch: refetchUsers } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await authFetch("/api/admin/users");
      return res.json();
    },
  });

  // Chunk stats
  const { data: chunkStats, refetch: refetchChunks } = useQuery({
    queryKey: ["/api/admin/chunks/stats"],
    queryFn: async () => {
      const res = await authFetch("/api/admin/chunks/stats");
      return res.json();
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: number; role: string }) => {
      await authFetch(`/api/admin/users/${id}`, {
        method: "PUT",
        body: JSON.stringify({ role }),
      });
    },
    onSuccess: () => {
      refetchUsers();
      toast({ title: "Đã cập nhật quyền" });
    },
  });

  const deleteUser = useMutation({
    mutationFn: async (id: number) => {
      await authFetch(`/api/admin/users/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      refetchUsers();
      toast({ title: "Đã xóa người dùng" });
    },
  });

  const rebuildChunks = useMutation({
    mutationFn: async (anchorOnly: boolean) => {
      const res = await authFetch("/api/admin/chunks/rebuild", {
        method: "POST",
        body: JSON.stringify({ anchor_only: anchorOnly }),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Đang xử lý chunks trong nền" });
      setTimeout(() => refetchChunks(), 5000);
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Quản trị hệ thống</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Quản lý người dùng và dữ liệu</p>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users" className="gap-1"><Users size={14} /> Người dùng</TabsTrigger>
          <TabsTrigger value="data" className="gap-1"><Database size={14} /> Dữ liệu</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Danh sách người dùng ({users?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingUsers ? (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
              ) : (
                <div className="space-y-1">
                  {users?.map((u: any) => (
                    <div key={u.id} className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-accent/50">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-[10px] font-medium text-primary">{u.name?.charAt(0)?.toUpperCase()}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{u.name}</p>
                        <p className="text-[10px] text-muted-foreground">{u.email}</p>
                      </div>
                      <Badge variant={u.role === "admin" ? "default" : "secondary"} className="text-[10px]">
                        {u.role === "admin" ? "Admin" : "User"}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString("vi-VN")}
                      </span>
                      <Button
                        variant="ghost" size="sm" className="h-7 px-2"
                        onClick={() => updateRole.mutate({ id: u.id, role: u.role === "admin" ? "user" : "admin" })}
                      >
                        <Shield size={12} />
                      </Button>
                      <Button
                        variant="ghost" size="sm" className="h-7 px-2 text-destructive"
                        onClick={() => deleteUser.mutate(u.id)}
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="mt-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Quản lý Document Chunks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{chunkStats?.total_chunks ?? "..."}</p>
                  <p className="text-xs text-muted-foreground">Tổng chunks</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Document chunks được sử dụng cho hybrid search. Mỗi văn bản thuế được chia thành các đoạn nhỏ (chunks) theo Điều/Khoản/Mục.
              </p>

              <div className="flex gap-2">
                <Button
                  variant="outline" size="sm"
                  onClick={() => rebuildChunks.mutate(true)}
                  disabled={rebuildChunks.isPending}
                >
                  {rebuildChunks.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : <RefreshCw size={14} className="mr-1" />}
                  Rebuild (Anchor only)
                </Button>
                <Button
                  variant="outline" size="sm"
                  onClick={() => rebuildChunks.mutate(false)}
                  disabled={rebuildChunks.isPending}
                >
                  Rebuild (Tất cả)
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
