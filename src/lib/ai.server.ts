const GATEWAY = "https://ai.gateway.lovable.dev";
const MODEL = "openai/gpt-6-astra";

export class AiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Streamed Responses call; SSE is consumed server-side and the final text
 * is returned. No buffered generateText / response.json().
 */
export async function astraText(instructions: string, input: string): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new AiError(503, "AI engine credentials are not configured on the server.");

  const response = await fetch(`${GATEWAY}/v1/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: MODEL,
      instructions,
      input,
      stream: true,
      store: false,
      reasoning: { effort: "low" },
    }),
  });

  if (!response.ok || !response.body) {
    let message = `AI engine returned ${response.status}.`;
    try {
      const text = await response.text();
      if (text) {
        try {
          const parsed = JSON.parse(text) as { error?: { message?: string }; message?: string };
          message = parsed.error?.message || parsed.message || text.slice(0, 400);
        } catch {
          message = text.slice(0, 400);
        }
      }
    } catch {
      /* keep default */
    }
    if (response.status === 402)
      throw new AiError(503, "Service is temporarily unavailable. Please try again later.");
    throw new AiError(response.status || 502, message);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let out = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      for (const line of part.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const event = JSON.parse(payload) as {
            type?: string;
            delta?: string;
            response?: { output_text?: string };
          };
          if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
            out += event.delta;
          }
        } catch {
          /* ignore keep-alive / partial frames */
        }
      }
    }
  }

  if (!out.trim()) throw new AiError(502, "AI engine returned an empty response.");
  return out;
}

export function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced?.[1] ?? raw).trim();
  const start = body.search(/[[{]/);
  if (start === -1) throw new AiError(502, "AI engine did not return usable data.");
  const slice = body.slice(start);
  try {
    return JSON.parse(slice);
  } catch {
    const lastBracket = Math.max(slice.lastIndexOf("]"), slice.lastIndexOf("}"));
    if (lastBracket > 0) {
      try {
        return JSON.parse(slice.slice(0, lastBracket + 1));
      } catch {
        /* fall through */
      }
    }
    throw new AiError(502, "AI engine returned malformed data.");
  }
}
