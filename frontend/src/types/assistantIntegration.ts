export type AssistantRequest = {
  question: string;
};

export type AssistantCitation = {
  title: string;
  url?: string;
};

export type AssistantResponse = {
  answer: string;
  citations: AssistantCitation[];
};

export type AssistantOutcome =
  | { status: "success"; response: AssistantResponse }
  | { status: "insufficient-evidence"; citations: AssistantCitation[] }
  | { status: "unavailable" }
  | { status: "timeout" }
  | { status: "error" };

export interface AssistantService {
  ask(request: AssistantRequest): Promise<AssistantOutcome>;
}
