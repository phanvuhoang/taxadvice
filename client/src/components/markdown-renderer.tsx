import { marked } from "marked";
import { useMemo } from "react";

interface MarkdownRendererProps {
  content: string;
  streaming?: boolean;
  className?: string;
}

// Process citation references [1], [2] etc. and turn into superscript anchor links
function processCitations(html: string): string {
  // Replace [N] patterns with superscript links
  return html.replace(/\[(\d+)\]/g, (match, num) => {
    return `<sup><a href="#citation-${num}" class="citation-ref">[${num}]</a></sup>`;
  });
}

// Add id anchors to citation list items at the end (e.g., lines starting with [1] ...)
function processCitationList(html: string): string {
  // Match paragraphs or list items that start with [N]
  return html.replace(/<(p|li)>(\[(\d+)\])/g, (match, tag, bracket, num) => {
    return `<${tag} id="citation-${num}">${bracket}`;
  });
}

export function MarkdownRenderer({ content, streaming, className }: MarkdownRendererProps) {
  const html = useMemo(() => {
    if (!content) return "";
    try {
      let rendered = marked.parse(content, { breaks: true, gfm: true }) as string;
      // Process citation list items first (add id anchors)
      rendered = processCitationList(rendered);
      // Then process inline citation references (add superscript links)
      rendered = processCitations(rendered);
      return rendered;
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
