import { marked } from "marked";
import { useMemo } from "react";

interface MarkdownRendererProps {
  content: string;
  streaming?: boolean;
  className?: string;
}

export function MarkdownRenderer({ content, streaming, className }: MarkdownRendererProps) {
  const html = useMemo(() => {
    if (!content) return "";
    try {
      return marked.parse(content, { breaks: true, gfm: true }) as string;
    } catch {
      return content;
    }
  }, [content]);

  return (
    <div
      className={`markdown-content ${streaming ? "streaming-cursor" : ""} ${className || ""}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
