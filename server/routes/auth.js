import {
  AUTH_CREDENTIALS_DTO_SCHEMA,
} from "../../shared/contracts/v1.js";
import { AuthError, AuthService } from "../services/auth-service.js";

const DEFAULT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function originFor(request) {
  return `${request.protocol}://${request.host}`;
}

function allowedOrigins(request) {
  const configured = request.server.config.allowedOrigins;
  if (Array.isArray(configured) && configured.length > 0) return configured;
  return [originFor(request)];
}

async function requireSameOrigin(request, reply) {
  const origin = request.headers.origin;
  if (!origin || !allowedOrigins(request).includes(origin)) {
    return reply.code(403).send({
      code: "ORIGIN_FORBIDDEN",
      message: "Request origin is not allowed",
    });
  }
}

function cookieOptions(config) {
  return {
    path: "/",
    httpOnly: true,
    secure: config.isProduction === true,
    sameSite: "lax",
    signed: true,
    maxAge: Math.floor((config.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS) / 1000),
  };
}

function readSessionToken(request) {
  const signed = request.cookies.sid;
  if (!signed) return null;
  const result = request.unsignCookie(signed);
  return result.valid ? result.value : null;
}

function sendAuthError(reply, error) {
  if (!(error instanceof AuthError)) throw error;
  return reply.code(error.statusCode).send({ code: error.code, message: error.message });
}

export async function authRoutes(app) {
  const config = app.config;
  const service = new AuthService(app.db, {
    sessionTtlMs: config.sessionTtlMs,
  });
  const rateLimit = {
    max: config.authRateLimitMax ?? 10,
    timeWindow: config.authRateLimitWindow ?? "1 minute",
  };
  const credentialsSchema = { body: AUTH_CREDENTIALS_DTO_SCHEMA };

  app.post("/register", {
    schema: credentialsSchema,
    preHandler: requireSameOrigin,
    config: { rateLimit },
  }, async (request, reply) => {
    try {
      const result = await service.register(request.body);
      reply.setCookie("sid", result.token, cookieOptions(config));
      return reply.code(201).send({ account: result.account });
    } catch (error) {
      return sendAuthError(reply, error);
    }
  });

  app.post("/login", {
    schema: credentialsSchema,
    preHandler: requireSameOrigin,
    config: { rateLimit },
  }, async (request, reply) => {
    try {
      const result = await service.login(request.body);
      reply.setCookie("sid", result.token, cookieOptions(config));
      return { account: result.account };
    } catch (error) {
      return sendAuthError(reply, error);
    }
  });

  app.get("/session", async (request, reply) => {
    const account = await service.authenticate(readSessionToken(request));
    if (!account) {
      return reply.code(401).send({ code: "UNAUTHENTICATED", message: "Authentication required" });
    }
    return { account };
  });

  app.post("/logout", { preHandler: requireSameOrigin }, async (request, reply) => {
    await service.logout(readSessionToken(request));
    reply.setCookie("sid", "", { ...cookieOptions(config), maxAge: 0 });
    return reply.code(204).send();
  });
}
