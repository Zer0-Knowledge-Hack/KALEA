import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';
import { QuoteError } from '@kalea/shared';

/** An API error with a stable machine-readable code. Rendered as `{ error: { code, message } }`. */
export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const STATUS_CODES: Record<number, string> = {
  400: 'bad_request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
};

const body = (code: string, message: string) => ({ error: { code, message } });

/** Parses a JSON body against a schema, mapping malformed JSON and schema failures to 400s. */
export async function parseBody<S extends z.ZodType>(c: Context, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new ApiError(400, 'invalid_json', 'Request body must be valid JSON');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.join('.');
    throw new ApiError(
      400,
      'invalid_request',
      path ? `${path}: ${issue.message}` : (issue?.message ?? 'Invalid request'),
    );
  }
  return parsed.data;
}

export function onError(err: Error, c: Context) {
  if (err instanceof ApiError) return c.json(body(err.code, err.message), err.status);
  if (err instanceof QuoteError) return c.json(body(err.code, err.message), 400);
  if (err instanceof HTTPException) {
    return c.json(
      body(STATUS_CODES[err.status] ?? 'http_error', err.message || 'Request failed'),
      err.status as ContentfulStatusCode,
    );
  }
  console.error(err);
  return c.json(body('internal_error', 'Internal server error'), 500);
}

export const notFound = (c: Context) => c.json(body('not_found', 'Route not found'), 404);
