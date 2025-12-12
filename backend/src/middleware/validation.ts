import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

export const loginSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

export const registerSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(20, 'Username must be less than 20 characters'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100, 'Password too long')
});

export const progressSyncSchema = z.object({
  learnedWords: z.record(z.string(), z.boolean()),
  masteredWords: z.record(z.string(), z.boolean()),
  currentGrade: z.number().int().min(71).max(92),
  currentViewMode: z.enum(['learn', 'list', 'search']),
  currentFilter: z.enum(['all', 'mastered', 'not-mastered'])
});

export function validateBody(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      return res.status(400).json({ error: 'Invalid request data' });
    }
  };
}