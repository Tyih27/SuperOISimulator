import { randomUUID } from "node:crypto";
import { FEEDBACK_CREATE_DTO_SCHEMA } from "../../shared/contracts/v1.js";
import { AuthService } from "../services/auth-service.js";
import { FeedbackRepository } from "../repositories/feedback-repository.js";

function readSessionToken(request) {
  const signed = request.cookies.sid;
  if (!signed) return null;
  const result = request.unsignCookie(signed);
  return result.valid ? result.value : null;
}

function originFor(request) {
  return `${request.protocol}://${request.host}`;
}

async function requireSameOrigin(request, reply) {
  const configured = request.server.config.allowedOrigins;
  const origins = Array.isArray(configured) && configured.length > 0 ? configured : [originFor(request)];
  if (!request.headers.origin || !origins.includes(request.headers.origin)) {
    return reply.code(403).send({ code: "ORIGIN_FORBIDDEN", message: "Request origin is not allowed" });
  }
}

async function requireAccount(request, reply) {
  const account = await request.server.feedbackAuthService.authenticate(readSessionToken(request));
  if (!account) return reply.code(401).send({ code: "UNAUTHENTICATED", message: "Authentication required" });
  request.account = account;
}

async function requireAdmin(request, reply) {
  if (request.account.role !== "admin") {
    return reply.code(403).send({ code: "ADMIN_REQUIRED", message: "Administrator access required" });
  }
}

export async function feedbackRoutes(app) {
  const repository = new FeedbackRepository(app.db);
  app.decorate("feedbackAuthService", new AuthService(app.db, { sessionTtlMs: app.config.sessionTtlMs }));

  app.post("/", {
    preHandler: [requireSameOrigin, requireAccount],
    schema: { body: FEEDBACK_CREATE_DTO_SCHEMA },
  }, async (request, reply) => {
    const message = request.body.message.trim();
    if (!message) return reply.code(400).send({ code: "INVALID_FEEDBACK", message: "Feedback message cannot be blank" });
    const feedback = await repository.create({
      id: randomUUID(),
      accountId: request.account.id,
      category: request.body.category ?? "other",
      message,
    });
    return reply.code(201).send({ feedback });
  });

  app.get("/", { preHandler: [requireAccount, requireAdmin] }, async (request) => {
    const requestedLimit = Number.parseInt(request.query?.limit ?? "100", 10);
    const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 200) : 100;
    return { feedback: await repository.list({ limit }) };
  });
}
