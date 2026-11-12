import type { PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
import { DomainError } from './domain-error.js';

export interface ValidationIssue {
  /** Caminho do campo com pontos (`windows.0.startTime`); vazio para o objeto todo. */
  path: string;
  message: string;
}

/**
 * Pipe Zod único da API: valida body/query/params com o schema de `@agende/contracts` e devolve
 * o valor **parseado** (campos extras removidos, coerções aplicadas). Falha → 400 VALIDATION_ERROR.
 * Uso: `@Body(new ZodValidationPipe(schema))`.
 */
export class ZodValidationPipe<S extends z.ZodType> implements PipeTransform<unknown, z.output<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.output<S> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    const issues: ValidationIssue[] = result.error.issues.map((issue) => ({
      path: issue.path.map(String).join('.'),
      message: issue.message,
    }));
    throw new DomainError('VALIDATION_ERROR', undefined, { issues });
  }
}
