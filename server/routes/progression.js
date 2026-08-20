import { SHOP_PURCHASE_DTO_SCHEMA, SPECIALIST_TRAINING_DTO_SCHEMA } from "../../shared/contracts/v1.js";
import { AuthService } from "../services/auth-service.js";
import { ProgressionError, ProgressionService } from "../services/progression-service.js";

function readSessionToken(request) {
  const signed = request.cookies.sid;
  if (!signed) return null;
  const result = request.unsignCookie(signed);
  return result.valid ? result.value : null;
}

function sendProgressionError(reply, error) {
  if (!(error instanceof ProgressionError)) throw error;
  return reply.code(error.statusCode).send({ code: error.code, message: error.message });
}

async function requireSameOrigin(request, reply) {
  const configured = request.server.config.allowedOrigins;
  const defaultOrigin = `${request.protocol}://${request.host}`;
  const origins = Array.isArray(configured) && configured.length > 0 ? configured : [defaultOrigin];
  if (!request.headers.origin || !origins.includes(request.headers.origin)) {
    return reply.code(403).send({ code: "ORIGIN_FORBIDDEN", message: "Request origin is not allowed" });
  }
}

async function requireAccount(request, reply) {
  const account = await request.server.progressionAuthService.authenticate(readSessionToken(request));
  if (!account) return reply.code(401).send({ code: "UNAUTHENTICATED", message: "Authentication required" });
  request.account = account;
}

function action(schema, handler, params) {
  return {
    preHandler: [requireSameOrigin, requireAccount],
    schema: { body: schema, ...(params ? { params } : {}) },
    handler,
  };
}

export async function progressionRoutes(app) {
  const service = new ProgressionService(app.db, { now: app.config.now, idFactory: app.config.idFactory });
  app.decorate("progressionAuthService", new AuthService(app.db, { sessionTtlMs: app.config.sessionTtlMs }));

  app.post("/training/specialist", action(SPECIALIST_TRAINING_DTO_SCHEMA, async (request, reply) => {
    try {
      return await service.trainSpecialist(request.account.id, request.body);
    } catch (error) {
      return sendProgressionError(reply, error);
    }
  }));

  app.post("/shop/purchases", action(SHOP_PURCHASE_DTO_SCHEMA, async (request, reply) => {
    try {
      return await service.purchaseShopOffer(request.account.id, request.body);
    } catch (error) {
      return sendProgressionError(reply, error);
    }
  }));

  app.post("/students/:studentId/dismiss", action(
    { type: "object", additionalProperties: false },
    async (request, reply) => {
      try {
        return await service.dismissStudent(request.account.id, request.params);
      } catch (error) {
        return sendProgressionError(reply, error);
      }
    },
    { type: "object", required: ["studentId"], properties: { studentId: { type: "string", minLength: 1, maxLength: 128 } }, additionalProperties: false },
  ));

  app.post("/recruitment", action({ type: "object", additionalProperties: false }, async (request, reply) => {
    try {
      return await service.recruitStudent(request.account.id);
    } catch (error) {
      return sendProgressionError(reply, error);
    }
  }));
}
