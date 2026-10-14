import type { AssistantService } from "../types/assistantIntegration";

export const unavailableAssistantService: AssistantService = {
  async ask(_request) {
    return { status: "unavailable" };
  },
};
