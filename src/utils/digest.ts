/**
 * Feed Synthesis and Digest Generation
 *
 * Combines multiple feed sources into synthesized digests and detects patterns.
 */

export interface DigestData {
  upstream: string;
  trends: string;
  arxiv: string;
}

/**
 * Synthesize multiple feeds into a combined digest
 */
export function synthesizeDigest(data: DigestData): string {
  const sections = [];

  sections.push("# Arc Intelligence Digest");
  sections.push("");
  sections.push(`Generated: ${new Date().toISOString()}`);
  sections.push("");
  sections.push(
    "Arc continuously monitors GitHub repos, X/Twitter activity, and arxiv research papers."
  );
  sections.push(
    "This digest combines all intelligence sources for a comprehensive view of the ecosystem."
  );
  sections.push("");

  if (data.upstream && data.upstream !== "No data available") {
    sections.push("## Upstream Activity (GitHub)");
    sections.push("");
    sections.push(data.upstream);
    sections.push("");
  }

  if (data.trends && data.trends !== "No data available") {
    sections.push("## Ecosystem Trends (X)");
    sections.push("");
    sections.push(data.trends);
    sections.push("");
  }

  if (data.arxiv && data.arxiv !== "No data available") {
    sections.push("## Research Papers (Arxiv)");
    sections.push("");
    sections.push(data.arxiv);
    sections.push("");
  }

  sections.push("---");
  sections.push("");
  sections.push("*Feed provided by Arc (arc0.btc) • Genesis Agent #1*");
  sections.push("*Updated every 30 minutes to 6 hours depending on source*");

  return sections.join("\n");
}

/**
 * Detect patterns in feed data
 *
 * Returns array of pattern descriptions for quick insights.
 * Future enhancement: LLM-based pattern analysis.
 */
export function detectPatterns(data: DigestData): string[] {
  const patterns: string[] = [];

  // Pattern: Multiple upstream releases
  const releaseMatches = data.upstream.match(/\*\*Releases:\*\*/g);
  if (releaseMatches && releaseMatches.length > 2) {
    patterns.push(
      `High upstream activity: ${releaseMatches.length} repos with new releases`
    );
  }

  // Pattern: High social engagement
  const likeMatches = Array.from(data.trends.matchAll(/❤️(\d+)/g));
  if (likeMatches.length > 0) {
    const totalLikes = likeMatches.reduce(
      (sum, match) => sum + parseInt(match[1], 10),
      0
    );
    if (totalLikes > 1000) {
      patterns.push(
        `High social engagement: ${totalLikes} total likes across trending content`
      );
    }
  }

  // Pattern: New papers on specific topics
  const agentPapers = Array.from(
    data.arxiv.matchAll(/\*\*(.*?agent.*?)\*\*/gi)
  );
  if (agentPapers.length > 2) {
    patterns.push(
      `Research focus: ${agentPapers.length} new papers on AI agents`
    );
  }

  // Pattern: Multiple PRs or issues
  const prMatches = data.upstream.match(/\*\*Pull Requests:\*\*/g);
  const issueMatches = data.upstream.match(/\*\*Issues:\*\*/g);
  const totalActivity =
    (prMatches?.length || 0) + (issueMatches?.length || 0);
  if (totalActivity > 5) {
    patterns.push(
      `Active development: ${totalActivity} repos with PR/issue activity`
    );
  }

  // Pattern: No activity (worth noting)
  if (
    data.upstream === "No data available" &&
    data.trends === "No data available" &&
    data.arxiv === "No data available"
  ) {
    patterns.push("All feeds offline or no new data");
  }

  return patterns;
}

/**
 * Generate digest summary (for prompt context or notifications)
 */
export function generateDigestSummary(data: DigestData): string {
  const patterns = detectPatterns(data);

  const lines = ["Feed Digest Summary:", ""];

  if (patterns.length > 0) {
    lines.push("**Patterns Detected:**");
    for (const pattern of patterns) {
      lines.push(`- ${pattern}`);
    }
    lines.push("");
  }

  // Count items per feed
  const upstreamRepos =
    data.upstream.match(/### [a-zA-Z0-9-_]+\/[a-zA-Z0-9-_]+/g)?.length || 0;
  const trendTweets = data.trends.match(/- @/g)?.length || 0;
  const arxivPapers = data.arxiv.match(/\*\*.*?\*\*/g)?.length || 0;

  lines.push("**Feed Stats:**");
  lines.push(`- Upstream: ${upstreamRepos} repos with activity`);
  lines.push(`- Trends: ${trendTweets} tweets tracked`);
  lines.push(`- Arxiv: ${arxivPapers} papers found`);

  return lines.join("\n");
}
