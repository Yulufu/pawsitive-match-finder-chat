const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export type PreferenceHardness = "must" | "strong" | "nice";

export interface PreferencePayload {
  field: string;
  hardness: PreferenceHardness;
  value: unknown;
  weight?: number;
  allow_unknown?: boolean;
}

export interface RecommendRequest {
  hard_filters: Record<string, unknown>;
  preferences: PreferencePayload[];
  seen_dog_ids: string[];
}

export interface RecommendResult {
  dog_id: string;
  name: string;
  section: "best" | "explore";
  score: number;
  completeness: number;
  reasons: Array<Record<string, unknown>>;
  dog_data: Record<string, unknown>;
}

export interface RecommendResponse {
  results: RecommendResult[];
  meta: {
    total_found: number;
    prompt_trigger?: string | null;
  };
}

export class ApiError extends Error {
  status: number;
  body?: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function fetchWithTimeout(
  path: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${DEFAULT_API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(id);
  }
}

export async function matchDogs(payload: RecommendRequest, timeoutMs?: number): Promise<RecommendResponse> {
  const res = await fetchWithTimeout(
    "/api/recommend",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    timeoutMs
  );

  let body: unknown;
  try {
    body = await res.json();
  } catch (err) {
    throw new ApiError("Failed to parse API response", res.status, undefined);
  }

  if (!res.ok) {
    const detail = (body as { detail?: string })?.detail;
    throw new ApiError(detail || "Failed to fetch recommendations", res.status, body);
  }

  return body as RecommendResponse;
}
