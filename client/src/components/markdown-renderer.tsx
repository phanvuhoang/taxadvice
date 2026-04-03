import { marked } from "marked";
import { useMemo } from "react";

interface MarkdownRendererProps {
  content: string;
  streaming?: boolean;
  className?: string;
  citations?: Array<{ so_hieu: string; url?: string; article_ref?: string; excerpt?: string }>;
}

// Render [N] as plain superscript text (no link) — these are inline reference markers
function processCitations(html: string): string {
  return html.replace(/\[(\d+)\]/g, (_match, num) => {
    return `<sup class="citation-ref">[${num}]</sup>`;
  });
}

export function MarkdownRenderer({ content, streaming, className, citations }: MarkdownRendererProps) {
  const html = useMemo(() => {
    if (!content) return "";
    try {
      let rendered = marked.parse(content, { breaks: true, gfm: true }) as string;
      rendered = processCitations(rendered);
      return rendered;
    } catch {
      return content;
    }
  }, [content]);

  // Filter web citations (those with http URLs)
  const webCitations = useMemo(() => {
    if (!citations) return [];
    return citations.filter((c: any) => c.url && String(c.url).startsWith("http"));
  }, [citations]);

  return (
    <div className={className || ""}>
      <div
        className={`markdown-content ${streaming ? "streaming-cursor" : ""}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {webCitations.length > 0 && !streaming && (
        <div className="mt-4 pt-3 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground mb-2">Nguồn internet tham khảo:</p>
          <div className="space-y-1">
            {webCitations.map((c: any, i: number) => (
              <div key={i} className="text-xs">
                <span className="text-muted-foreground">[{i + 1}]</span>{" "}
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline break-all"
                >
                  {c.url}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
