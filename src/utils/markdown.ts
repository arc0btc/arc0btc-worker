/**
 * Markdown Utilities
 *
 * Simple markdown to HTML conversion for feed rendering.
 */

/**
 * Convert markdown to basic HTML
 *
 * Supports:
 * - Headers (###, ##, #)
 * - Links ([text](url))
 * - Bold (**text**)
 * - Lists (-, *)
 * - Code blocks (```)
 */
export function markdownToHtml(markdown: string): string {
  let html = markdown;

  // Headers
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Lists
  html = html.replace(/^[*-] (.+)$/gm, "<li>$1</li>");

  // Wrap consecutive list items in ul
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  // Paragraphs (lines not already in tags)
  const lines = html.split("\n");
  const withParagraphs = lines.map((line) => {
    if (
      line.trim() &&
      !line.match(/^<(h[1-6]|ul|li|a|strong)/) &&
      !line.match(/<\/(h[1-6]|ul|li|a|strong)>$/)
    ) {
      return `<p>${line}</p>`;
    }
    return line;
  });

  return withParagraphs.join("\n");
}

/**
 * Render a feed page with markdown content
 */
export function renderFeedPage(title: string, content: string): string {
  const htmlContent = markdownToHtml(content);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Arc Feed</title>
  <link rel="icon" href="https://arc0.me/favicon.ico">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: #E9D4CF;
      background: #000000;
      padding: 2rem 1rem;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
      background: #000000;
      padding: 2rem;
      border: 1px solid #1a1a1c;
    }

    h1 {
      color: #ffffff;
      margin-bottom: 1.5rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid #FEC233;
    }

    h2 {
      color: #ffffff;
      margin-top: 2rem;
      margin-bottom: 1rem;
      border-left: 3px solid #FEC233;
      padding-left: 0.75rem;
    }

    h3 {
      color: #E9D4CF;
      margin-top: 1.5rem;
      margin-bottom: 0.75rem;
    }

    p {
      margin-bottom: 1rem;
      color: #E9D4CF;
    }

    ul {
      margin-left: 2rem;
      margin-bottom: 1rem;
    }

    li {
      margin-bottom: 0.5rem;
      color: #E9D4CF;
    }

    a {
      color: #FEC233;
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    code, pre {
      font-family: "Courier New", "Menlo", "Monaco", monospace;
      background: #0c0c0e;
      color: #FEC233;
      padding: 0.1rem 0.3rem;
      font-size: 0.9em;
      border-left: 3px solid #FEC233;
    }

    .footer {
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 1px solid #1a1a1c;
      text-align: center;
      color: #E9D4CF;
      opacity: 0.6;
      font-size: 0.9rem;
    }

    .footer a {
      color: #FEC233;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${title}</h1>
    ${htmlContent}
    <div class="footer">
      <p>Feed provided by <a href="/">Arc (arc0.btc)</a> &bull; Genesis Agent #1</p>
      <p><a href="/">Back to Home</a> | <a href="/health">Health Check</a></p>
    </div>
  </div>
</body>
</html>`;
}
