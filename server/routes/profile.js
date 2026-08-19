import { PROFILE_UPDATE_DTO_SCHEMA } from "../../shared/contracts/v1.js";
import { AuthService } from "../services/auth-service.js";
import { ProfileError, ProfileService } from "../services/profile-service.js";

function readSessionToken(request) {
  const signed = request.cookies.sid;
  if (!signed) return null;
  const result = request.unsignCookie(signed);
  return result.valid ? result.value : null;
}

function sendProfileError(reply, error) {
  if (!(error instanceof ProfileError)) throw error;
  return reply.code(error.statusCode).send({ code: error.code, message: error.message });
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
  const token = readSessionToken(request);
  const account = await request.server.profileAuthService.authenticate(token);
  if (!account) return reply.code(401).send({ code: "UNAUTHENTICATED", message: "Authentication required" });
  request.account = account;
}

export async function profileRoutes(app) {
  const service = new ProfileService(app.db);
  app.decorate("profileAuthService", new AuthService(app.db, { sessionTtlMs: app.config.sessionTtlMs }));

  app.get("/", { preHandler: requireAccount }, async (request, reply) => {
    try {
      return service.get(request.account.id);
    } catch (error) {
      return sendProfileError(reply, error);
    }
  });

  app.put("/", {
    preHandler: [requireSameOrigin, requireAccount],
    schema: { body: PROFILE_UPDATE_DTO_SCHEMA },
  }, async (request, reply) => {
    try {
      return service.update(request.account.id, request.body);
    } catch (error) {
      return sendProfileError(reply, error);
    }
  });
}
