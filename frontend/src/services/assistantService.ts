import type { AssistantOutcome, AssistantService, AssistantRequest } from "../types/assistantIntegration";
import { requestApi } from "./apiClient";

type BackendSource = { title: string; url?: string };
type BackendAnswer = {
  answer: string;
  sources: BackendSource[];
  insufficientEvidence: boolean;
};

export const assistantService: AssistantService = {
  async ask(request: AssistantRequest): Promise<AssistantOutcome> {
    try {
      const result = await requestApi<BackendAnswer>("/ai/assistant", {
        method: "POST",
        body: { message: request.question },
      });
      const citations = result.sources.map((source) => ({ title: source.title, ...(source.url ? { url: source.url } : {}) }));
      return result.insufficientEvidence
        ? { status: "insufficient-evidence", citations }
        : { status: "success", response: { answer: result.answer, citations } };
    } catch {
      return { status: "unavailable" };
    }
  },
};
