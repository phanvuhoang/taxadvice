import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { AppUserPublic } from "@shared/schema";

const JWT_SECRET = process.env.JWT_SECRET || "taxadvice-dev-secret-change-me";
const JWT_EXPIRY = "7d";

export function generateToken(user: AppUserPublic): string {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

export function verifyToken(token: string): { id: number; email: string; role: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as any;
  } catch {
    return null;
  }
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: { id: number; email: string; role: string };
    }
  }
}

// Auth middleware
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Vui lòng đăng nhập" });
  }

  const token = authHeader.split(" ")[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ message: "Token không hợp lệ hoặc đã hết hạn" });
  }

  req.user = decoded;
  next();
}

// Admin middleware
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Bạn không có quyền truy cập" });
  }
  next();
}
