import { EMPTY_DTO_SCHEMA, BOSS_CHALLENGE_START_DTO_SCHEMA } from "../../shared/contracts/v1.js";
import { AuthService } from "../services/auth-service.js";
import { BossError, BossService } from "../services/boss-service.js";

function token(request) { const signed = request.cookies.sid; if (!signed) return null; const result = request.unsignCookie(signed); return result.valid ? result.value : null; }
async function origin(request, reply) { const configured = request.server.config.allowedOrigins; const allowed = Array.isArray(configured) && configured.length ? configured : [`${request.protocol}://${request.host}`]; if (!request.headers.origin || !allowed.includes(request.headers.origin)) return reply.code(403).send({ code: "ORIGIN_FORBIDDEN", message: "Request origin is not allowed" }); }
async function account(request, reply) { const value = await request.server.bossAuthService.authenticate(token(request)); if (!value) return reply.code(401).send({ code: "UNAUTHENTICATED", message: "Authentication required" }); request.account = value; }
function action(schema, handler) { return { preHandler: [origin, account], schema: { body: schema }, handler: async (request, reply) => { try { return await handler(request, reply); } catch (error) { if (!(error instanceof BossError)) throw error; return reply.code(error.statusCode).send({ code: error.code, message: error.message }); } } }; }

export async function bossRoutes(app) {
  const service = new BossService(app.db, { now: app.config.now, idFactory: app.config.idFactory, starterStudentIds: app.config.defaultStarterIds ?? null });
  app.decorate("bossAuthService", new AuthService(app.db, { sessionTtlMs: app.config.sessionTtlMs }));
  app.get("/quota", { preHandler: account }, async (request) => { const client = await app.db.connect(); try { return await service.dailyQuota(client, request.account.id); } finally { client.release(); } });
  app.get("/challenges", { preHandler: account }, (request) => service.history(request.account.id, request.query?.limit));
  app.post("/challenges", { preHandler: [origin, account], schema: { body: BOSS_CHALLENGE_START_DTO_SCHEMA } }, async (request, reply) => {
    try { return reply.code(201).send(await service.start(request.account.id, request.body)); }
    catch (error) { if (!(error instanceof BossError)) throw error; return reply.code(error.statusCode).send({ code: error.code, message: error.message }); }
  });
  app.post("/challenges/:id/settle", action(EMPTY_DTO_SCHEMA, (request) => service.settle(request.account.id, request.params.id)));
}
