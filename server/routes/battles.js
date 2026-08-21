import { BATTLE_START_DTO_SCHEMA, EMPTY_DTO_SCHEMA } from "../../shared/contracts/v1.js";
import { AuthService } from "../services/auth-service.js";
import { BattleError, BattleService } from "../services/battle-service.js";

function readSessionToken(request) {
  const signed = request.cookies.sid;
  if (!signed) return null;
  const result = request.unsignCookie(signed);
  return result.valid ? result.value : null;
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
  const account = await request.server.battleAuthService.authenticate(readSessionToken(request));
  if (!account) return reply.code(401).send({ code: "UNAUTHENTICATED", message: "Authentication required" });
  request.account = account;
}

function sendBattleError(reply, error) {
  if (!(error instanceof BattleError)) throw error;
  return reply.code(error.statusCode).send({ code: error.code, message: error.message });
}

export async function battleRoutes(app) {
  const service = new BattleService(app.db, { now: app.config.now, idFactory: app.config.idFactory });
  app.decorate("battleAuthService", new AuthService(app.db, { sessionTtlMs: app.config.sessionTtlMs }));
  const protectedAction = { preHandler: [requireSameOrigin, requireAccount] };

  app.post("/campaign/battles", {
    ...protectedAction,
    schema: { body: BATTLE_START_DTO_SCHEMA },
  }, async (request, reply) => {
    try {
      return reply.code(201).send(await service.start(request.account.id, request.body));
    } catch (error) {
      return sendBattleError(reply, error);
    }
  });

  app.get("/campaign/battles", { preHandler: requireAccount }, async (request) => service.history(request.account.id, request.query));

  app.post("/campaign/battles/:id/settle", {
    ...protectedAction,
    schema: { body: EMPTY_DTO_SCHEMA },
  }, async (request, reply) => {
    try {
      return await service.settle(request.account.id, request.params.id);
    } catch (error) {
      return sendBattleError(reply, error);
    }
  });
}
