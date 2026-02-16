/**
 * Agent Detection Middleware
 *
 * Detects whether the requester is an agent or human based on
 * user-agent string and Accept headers. Supports content negotiation.
 */

export interface AgentDetectionResult {
  isAgent: boolean;
  preferredFormat: "json" | "markdown" | "html";
}

/**
 * Detect if requester is an agent and determine preferred response format
 */
export function detectAgent(
  userAgent: string,
  accept: string
): AgentDetectionResult {
  // Agent indicators in user-agent string
  const agentPatterns = [
    /curl/i,
    /wget/i,
    /httpie/i,
    /python-requests/i,
    /axios/i,
    /fetch/i,
    /bot/i,
    /crawler/i,
    /spider/i,
    /anthropic/i,
    /openai/i,
    /claude/i,
    /gpt/i,
  ];

  const isAgentUA = agentPatterns.some((pattern) => pattern.test(userAgent));

  // Parse Accept header for format preference
  const acceptLower = accept.toLowerCase();
  const acceptsJson = acceptLower.includes("application/json");
  const acceptsMarkdown = acceptLower.includes("text/markdown");
  const acceptsHtml =
    acceptLower.includes("text/html") || acceptLower.includes("*/*");

  // Determine preferred format based on Accept header
  let preferredFormat: "json" | "markdown" | "html";
  if (acceptsJson) {
    preferredFormat = "json";
  } else if (acceptsMarkdown) {
    preferredFormat = "markdown";
  } else {
    preferredFormat = "html";
  }

  // Consider requester an agent if:
  // 1. User-agent matches agent patterns, OR
  // 2. Explicitly requests JSON/markdown
  const isAgent = isAgentUA || acceptsJson || acceptsMarkdown;

  return {
    isAgent,
    preferredFormat,
  };
}
