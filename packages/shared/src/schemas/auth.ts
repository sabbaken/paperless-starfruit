import { z } from 'zod';

/**
 * Single-admin auth. There's no public sign-up: the first-run setup claims the
 * instance (creates the one admin), after which registration is closed and only
 * login is possible.
 */

/** First-run setup payload: stricter password rules than login. */
export const registerInputSchema = z.object({
  username: z.string().trim().min(3).max(64),
  password: z.string().min(8).max(256),
});
export type RegisterInput = z.infer<typeof registerInputSchema>;

/** Login payload: accept whatever was registered, don't leak the rules. */
export const loginInputSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

/**
 * Public bootstrap state for the web gate: is the instance claimed yet, and is
 * the caller's current token still valid?
 */
export const authStatusSchema = z.object({
  initialized: z.boolean(),
  authenticated: z.boolean(),
});
export type AuthStatus = z.infer<typeof authStatusSchema>;

/** Successful login/register: the bearer token + who it belongs to. */
export const authResultSchema = z.object({
  token: z.string(),
  username: z.string(),
});
export type AuthResult = z.infer<typeof authResultSchema>;
