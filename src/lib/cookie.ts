/**
 * Deliberately dependency-free.
 *
 * middleware.ts runs on the Edge runtime, which cannot load native modules.
 * Importing this constant from session.ts pulled in crypto.ts and with it the
 * @node-rs/argon2 binding, breaking the build. Keeping the name here lets both
 * runtimes share it without sharing anything else.
 *
 * Contains no secret — only the cookie's name.
 */
export const COOKIE = "btv_admin_session";
