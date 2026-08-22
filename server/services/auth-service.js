import { createHash, randomBytes, randomUUID } from "node:crypto";
import argon2 from "argon2";
import { AccountRepository } from "../repositories/account-repository.js";
import { AuditRepository } from "../repositories/audit-repository.js";

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,24}$/;
const MINIMUM_PASSWORD_LENGTH = 8;
const MAXIMUM_PASSWORD_LENGTH = 1024;
const DEFAULT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DUMMY_PASSWORD_HASH = "$argon2id$v=19$m=65536,p=4,t=3$oT0ozQlI8RrFqi0m6XfiTA$y6Uu/PGG9w4VF5+RTs+w1A5En2d5U7/LlhmdnLKJgy8";

export class AuthError extends Error {
  constructor(code, statusCode, message) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

function normalizeCredentials({ username, password } = {}) {
  if (typeof username !== "string" || !USERNAME_PATTERN.test(username)) {
    throw new AuthError(
      "INVALID_CREDENTIALS_FORMAT",
      400,
      "Username must contain 3-24 letters, numbers, or underscores",
    );
  }
  if (
    typeof password !== "string"
    || password.length < MINIMUM_PASSWORD_LENGTH
    || password.length > MAXIMUM_PASSWORD_LENGTH
  ) {
    throw new AuthError(
      "INVALID_CREDENTIALS_FORMAT",
      400,
      "Password must contain between 8 and 1024 characters",
    );
  }
  return { username: username.toLowerCase(), password };
}

function publicAccount(account) {
  return {
    id: account.id,
    username: account.username,
    role: account.role ?? "user",
    createdAt: account.created_at.toISOString(),
  };
}

export async function ensureAdminAccount(pool, { username = "admin", password = "superoi-admin" } = {}) {
  const credentials = normalizeCredentials({ username, password });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const repository = new AccountRepository(pool);
    const existing = await repository.findByUsernameForUpdate(client, credentials.username);
    const passwordHash = await argon2.hash(credentials.password, { type: argon2.argon2id });
    if (existing) {
      await repository.promoteToAdmin(client, existing.id);
      if (existing.role !== "admin") await repository.updatePassword(client, existing.id, passwordHash);
      await client.query(
        "UPDATE account_deletion_requests SET status = 'cancelled' WHERE account_id = $1 AND status = 'queued'",
        [existing.id],
      );
    } else {
      await repository.createAccount(client, {
        id: randomUUID(), username: credentials.username, passwordHash, role: "admin",
      });
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function hashSessionToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export class AuthService {
  constructor(pool, { sessionTtlMs = DEFAULT_SESSION_TTL_MS } = {}) {
    this.pool = pool;
    this.repository = new AccountRepository(pool);
    this.audit = new AuditRepository();
    this.sessionTtlMs = sessionTtlMs;
  }

  async register(credentials) {
    const { username, password } = normalizeCredentials(credentials);
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const session = this.createSessionInput();
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const account = await this.repository.createAccount(client, {
        id: randomUUID(),
        username,
        passwordHash,
      });
      await this.repository.createSession(client, {
        ...session,
        accountId: account.id,
      });
      await client.query("COMMIT");
      return { account: publicAccount(account), token: session.token };
    } catch (error) {
      await client.query("ROLLBACK");
      if (error.code === "23505") {
        throw new AuthError("USERNAME_TAKEN", 409, "Username is already registered");
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async login(credentials) {
    const { username, password } = normalizeCredentials(credentials);
    const account = await this.repository.findAccountForLogin(username);
    const passwordMatches = await argon2.verify(account?.password_hash ?? DUMMY_PASSWORD_HASH, password);
    if (!account || !passwordMatches) {
      throw new AuthError("INVALID_LOGIN", 401, "Username or password is incorrect");
    }

    const session = this.createSessionInput();
    const client = await this.pool.connect();
    try {
      await this.repository.createSession(client, {
        ...session,
        accountId: account.id,
      });
    } finally {
      client.release();
    }
    return { account: publicAccount(account), token: session.token };
  }

  async authenticate(token) {
    if (!token) return null;
    const account = await this.repository.findAccountBySessionHash(hashSessionToken(token));
    return account ? publicAccount(account) : null;
  }

  async logout(token) {
    if (token) await this.repository.revokeSession(hashSessionToken(token));
  }

  async changePassword(accountId, currentPassword, newPassword) {
    if (typeof accountId !== "string" || !accountId) throw new AuthError("UNAUTHENTICATED", 401, "Authentication required");
    const normalized = normalizeCredentials({ username: "password", password: newPassword });
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const account = await this.repository.findAccountByIdForUpdate(client, accountId);
      const matches = account && typeof currentPassword === "string"
        ? await argon2.verify(account.password_hash, currentPassword) : false;
      if (!matches) throw new AuthError("INVALID_CURRENT_PASSWORD", 400, "Current password is incorrect");
      const passwordHash = await argon2.hash(normalized.password, { type: argon2.argon2id });
      await this.repository.updatePassword(client, accountId, passwordHash);
      await this.repository.revokeAllSessions(client, accountId);
      await this.audit.append(client, { accountId, actionType: "password_change", payload: { changed: true } });
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteAccount(accountId, password) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const account = await this.repository.findAccountByIdForUpdate(client, accountId);
      const matches = account && typeof password === "string"
        ? await argon2.verify(account.password_hash, password) : false;
      if (!matches) throw new AuthError("INVALID_CURRENT_PASSWORD", 400, "Current password is incorrect");
      await this.repository.deleteAccount(client, accountId);
      await client.query("COMMIT");
      return { deleted: true };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  createSessionInput() {
    const token = randomBytes(32).toString("base64url");
    return {
      id: randomUUID(),
      token,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + this.sessionTtlMs),
    };
  }
}
