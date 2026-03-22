import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from './auth.validation';
import { z } from 'zod';
import type { createAuthService } from './auth.service';

const logoutSchema = z.object({
  accessToken: z.string().min(1),
});

type AuthService = ReturnType<typeof createAuthService>;

function classifyError(err: Error): { status: number; message: string } {
  const msg = err.message ?? '';

  if (/slug.*taken|already.*exist|unavailable/i.test(msg)) {
    return { status: 409, message: msg };
  }
  if (/locked|too.*many.*attempt/i.test(msg)) {
    return { status: 423, message: msg };
  }
  if (/invalid.*credentials|wrong.*password|unauthorized/i.test(msg)) {
    return { status: 401, message: 'Invalid credentials.' };
  }
  // Revoked JWT (refresh token) → 401; invalid/expired one-time tokens → 400
  if (/revoked/i.test(msg) || /invalid.*or.*expired.*refresh/i.test(msg)) {
    return { status: 401, message: msg };
  }
  if (/invalid.*or.*expired|not.*found/i.test(msg)) {
    return { status: 400, message: msg };
  }
  // Invalid JWT (bad signature, expired) from refresh
  if (/invalid.*token|expired.*token/i.test(msg)) {
    return { status: 401, message: msg };
  }

  return { status: 500, message: 'Internal server error' };
}

export function createAuthRouter(service: AuthService): Router {
  const router = Router();

  router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ success: false, error: parsed.error.issues });
      return;
    }
    try {
      const data = await service.register(parsed.data);
      res.status(201).json({ success: true, data });
    } catch (err) {
      const { status, message } = classifyError(err as Error);
      if (status === 500) return next(err);
      res.status(status).json({ success: false, error: message });
    }
  });

  router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ success: false, error: parsed.error.issues });
      return;
    }
    try {
      const data = await service.login(parsed.data);
      res.status(200).json({ success: true, data });
    } catch (err) {
      const { status, message } = classifyError(err as Error);
      if (status === 500) return next(err);
      res.status(status).json({ success: false, error: message });
    }
  });

  router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ success: false, error: parsed.error.issues });
      return;
    }
    try {
      const data = await service.refresh(parsed.data);
      res.status(200).json({ success: true, data });
    } catch (err) {
      const { status, message } = classifyError(err as Error);
      if (status === 500) return next(err);
      res.status(status).json({ success: false, error: message });
    }
  });

  router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
    const parsed = logoutSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ success: false, error: parsed.error.issues });
      return;
    }
    try {
      await service.logout(parsed.data);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  router.post('/forgot-password', async (req: Request, res: Response, next: NextFunction) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ success: false, error: parsed.error.issues });
      return;
    }
    try {
      await service.forgotPassword(parsed.data);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  router.post('/reset-password', async (req: Request, res: Response, next: NextFunction) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ success: false, error: parsed.error.issues });
      return;
    }
    try {
      await service.resetPassword(parsed.data);
      res.status(204).send();
    } catch (err) {
      const { status, message } = classifyError(err as Error);
      if (status === 500) return next(err);
      res.status(status).json({ success: false, error: message });
    }
  });

  router.post('/verify-email', async (req: Request, res: Response, next: NextFunction) => {
    const parsed = verifyEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({ success: false, error: parsed.error.issues });
      return;
    }
    try {
      await service.verifyEmail(parsed.data);
      res.status(204).send();
    } catch (err) {
      const { status, message } = classifyError(err as Error);
      if (status === 500) return next(err);
      res.status(status).json({ success: false, error: message });
    }
  });

  return router;
}
