import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { createSession, destroySession, getSettings, isSessionValid, saveSettings } from './db';

const SESSION_COOKIE = 'mic_admin';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12h

export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pin, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  if (!stored) return false;
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(pin, salt, 64);
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

export function issueSession(res: Response) {
  const id = crypto.randomBytes(32).toString('hex');
  createSession(id, SESSION_TTL_MS);
  res.cookie(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: SESSION_TTL_MS,
  });
}

export function clearSession(req: Request, res: Response) {
  const id = req.cookies?.[SESSION_COOKIE];
  if (id) destroySession(id);
  res.clearCookie(SESSION_COOKIE);
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const id = req.cookies?.[SESSION_COOKIE];
  if (!id || !isSessionValid(id)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  next();
}

export function adminConfigured(): boolean {
  return getSettings().adminPinHash !== '';
}

export function setInitialPin(pin: string) {
  if (adminConfigured()) throw new Error('PIN already set');
  saveSettings({ adminPinHash: hashPin(pin) });
}

export function changePin(oldPin: string, newPin: string): boolean {
  const s = getSettings();
  if (!verifyPin(oldPin, s.adminPinHash)) return false;
  saveSettings({ adminPinHash: hashPin(newPin) });
  return true;
}
