import axios, { AxiosError } from 'axios';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';

/** Single place to change AI endpoint paths (agree these with Nidhish; see shared/api-contracts). */
export const AI_PATHS = {
  briefing: '/api/v1/briefing',
  rag: '/api/v1/rag/query',
  risk: '/api/v1/risk/assess',
  copilot: '/api/v1/copilot/chat',
} as const;

const client = axios.create({
  baseURL: env.AI_ENGINE_URL,
  timeout: env.AI_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json', ...(env.AI_ENGINE_API_KEY ? { 'x-api-key': env.AI_ENGINE_API_KEY } : {}) },
});

/**
 * Authenticated service-to-service call. Failures become ApiErrors with stable codes:
 *  AI_UNAVAILABLE (network/timeout/5xx-unreachable) and AI_UPSTREAM_ERROR (AI service answered with an error).
 */
export async function aiPost<T = unknown>(path: string, payload: unknown, opts: { requestId?: string } = {}): Promise<T> {
  try {
    const { data } = await client.post<T>(path, payload, { headers: opts.requestId ? { 'x-request-id': opts.requestId } : {} });
    return data;
  } catch (e) {
    const err = e as AxiosError;
    logger.warn(`AI engine call failed ${path}: ${err.code ?? err.response?.status ?? err.message}`);
    if (!err.response || err.response.status === 503 || err.response.status === 504)
      throw new ApiError(503, 'AI service is currently unavailable', undefined, 'AI_UNAVAILABLE');
    if (err.response.status === 429) throw new ApiError(503, 'AI service is rate limited', undefined, 'AI_UNAVAILABLE');
    throw new ApiError(502, 'AI service returned an error', { status: err.response.status }, 'AI_UPSTREAM_ERROR');
  }
}
