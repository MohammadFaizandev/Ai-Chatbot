import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MarkdownResponse } from "@/components/chat/markdown-response";

function render(content: string): string {
  return renderToStaticMarkup(<MarkdownResponse content={content} />);
}

describe("Markdown security configuration", () => {
  it("does not render raw HTML from the model", () => {
    const html = render('Hello <script>alert("xss")</script> world');
    expect(html).not.toContain("<script>");
  });

  it("escapes HTML with event handlers instead of rendering it", () => {
    const html = render('<img src="x" onerror="alert(1)">');
    expect(html).not.toContain("<img");
    expect(html).not.toContain('onerror="alert(1)"');
    expect(html).toContain("&lt;img");
  });

  it("does not render iframes", () => {
    const html = render('<iframe src="https://evil.example"></iframe>');
    expect(html).not.toContain("<iframe");
  });

  it("adds safe attributes to links", () => {
    const html = render("[click me](https://example.com)");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
  });

  it("does not emit javascript: URLs", () => {
    const html = render("[click](javascript:alert(1))");
    expect(html).not.toContain('href="javascript:');
  });

  it("renders GFM tables and fenced code blocks", () => {
    const table = render("| a | b |\n| - | - |\n| 1 | 2 |");
    expect(table).toContain("<table");

    const code = render("```js\nconst x = 1;\n```");
    expect(code).toContain("<pre");
    expect(code).toContain("language-js");
  });
});
