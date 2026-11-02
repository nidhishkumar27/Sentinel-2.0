const DEFAULT_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  502: 'UPSTREAM_ERROR',
  503: 'SERVICE_UNAVAILABLE',
};

export class ApiError extends Error {
  public code: string;
  constructor(public statusCode: number, message: string, public details?: unknown, code?: string) {
    super(message);
    this.code = code ?? DEFAULT_CODES[statusCode] ?? 'ERROR';
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}
