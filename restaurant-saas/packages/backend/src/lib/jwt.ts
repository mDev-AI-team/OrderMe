import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { loadConfig } from '../config';
import type { JwtPayload } from '../modules/auth/auth.types';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;    // 15 minutes
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export function generateJti(): string {
  return randomUUID();
}

export function signAccessToken(payload: JwtPayload): string {
  const { jwtSecret } = loadConfig();
  return jwt.sign(payload, jwtSecret, { expiresIn: ACCESS_TOKEN_TTL_SECONDS });
}

export function signRefreshToken(payload: JwtPayload): string {
  const { jwtSecret } = loadConfig();
  return jwt.sign(payload, jwtSecret, { expiresIn: REFRESH_TOKEN_TTL_SECONDS });
}

export function verifyToken(token: string): JwtPayload {
  const { jwtSecret } = loadConfig();
  return jwt.verify(token, jwtSecret) as JwtPayload;
}
