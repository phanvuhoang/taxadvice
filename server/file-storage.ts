import fs from "fs";
import path from "path";

// Persistent file storage directory
// On Coolify: mount a Docker volume to /app/data
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const PDF_CACHE_DIR = path.join(DATA_DIR, "pdf-cache");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

// Ensure directories exist
export function initFileStorage() {
  for (const dir of [DATA_DIR, PDF_CACHE_DIR, UPLOADS_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  }
}

// Save PDF to cache
export function savePDFCache(outputId: number, buffer: Buffer): string {
  const filename = `taxadvice-${outputId}.pdf`;
  const filepath = path.join(PDF_CACHE_DIR, filename);
  fs.writeFileSync(filepath, buffer);
  return filepath;
}

// Get cached PDF
export function getCachedPDF(outputId: number): Buffer | null {
  const filename = `taxadvice-${outputId}.pdf`;
  const filepath = path.join(PDF_CACHE_DIR, filename);
  if (fs.existsSync(filepath)) {
    return fs.readFileSync(filepath);
  }
  return null;
}

// Delete cached PDF (when output is deleted)
export function deletePDFCache(outputId: number): void {
  const filename = `taxadvice-${outputId}.pdf`;
  const filepath = path.join(PDF_CACHE_DIR, filename);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }
}

export { DATA_DIR, PDF_CACHE_DIR, UPLOADS_DIR };
