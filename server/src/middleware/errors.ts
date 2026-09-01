import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found' });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof ZodError) {
    res.status(422).json({ error: 'Validation failed', details: err.flatten().fieldErrors });
    return;
  }
  const message = err instanceof Error ? err.message : 'Internal server error';
  console.error('[veyra:server]', err);
  res.status(500).json({ error: 'Internal server error', detail: message });
}
