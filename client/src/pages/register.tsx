import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { setAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/register", { email, password, name });
      const data = await res.json();
      setAuth(data.token, data.user);
      navigate("/");
    } catch (err: any) {
      toast({
        title: "Đăng ký thất bại",
        description: err.message?.includes("400") ? "Email đã được sử dụng" : err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-2">
          <div className="w-14 h-14 rounded-xl bg-primary mx-auto mb-3 flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-xl">TA</span>
          </div>
          <h1 className="text-xl font-semibold">Đăng ký tài khoản</h1>
          <p className="text-sm text-muted-foreground">TaxAdvice - Tư vấn Thuế Doanh nghiệp</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Họ và tên</Label>
              <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Nguyễn Văn A" required data-testid="input-name" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required data-testid="input-email" />
            </div>
            <div>
              <Label htmlFor="password">Mật khẩu</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Tối thiểu 6 ký tự" required minLength={6} data-testid="input-password" />
            </div>
            <Button type="submit" className="w-full" disabled={loading} data-testid="btn-register">
              {loading ? "Đang tạo tài khoản..." : "Đăng ký"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Đã có tài khoản?{" "}
            <Link href="/login"><span className="text-primary hover:underline cursor-pointer">Đăng nhập</span></Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
