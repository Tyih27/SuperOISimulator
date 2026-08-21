import { EMPTY_DTO_SCHEMA, ARENA_DEFENSE_DTO_SCHEMA, ARENA_MATCH_DTO_SCHEMA } from "../../shared/contracts/v1.js";
import { AuthService } from "../services/auth-service.js";
import { ArenaError, ArenaService } from "../services/arena-service.js";

function token(request) { const signed = request.cookies.sid; if (!signed) return null; const result = request.unsignCookie(signed); return result.valid ? result.value : null; }
async function origin(request, reply) { const configured = request.server.config.allowedOrigins; const allowed = Array.isArray(configured) && configured.length ? configured : [`${request.protocol}://${request.host}`]; if (!request.headers.origin || !allowed.includes(request.headers.origin)) return reply.code(403).send({ code: "ORIGIN_FORBIDDEN", message: "Request origin is not allowed" }); }
async function account(request, reply) { const value = await request.server.arenaAuthService.authenticate(token(request)); if (!value) return reply.code(401).send({ code: "UNAUTHENTICATED", message: "Authentication required" }); request.account = value; }
function action(schema, handler) { return { preHandler: [origin, account], schema: { body: schema }, handler: async (request, reply) => { try { return await handler(request, reply); } catch (error) { if (!(error instanceof ArenaError)) throw error; return reply.code(error.statusCode).send({ code: error.code, message: error.message }); } } }; }

export async function arenaRoutes(app) {
  const service = new ArenaService(app.db, { now: app.config.now, idFactory: app.config.idFactory, starterStudentIds: app.config.defaultStarterIds ?? null });
  app.decorate("arenaAuthService", new AuthService(app.db, { sessionTtlMs: app.config.sessionTtlMs }));
  app.get("/defense", { preHandler: account }, async (request) => { const client = await app.db.connect(); try { const row = await service.arena.getDefense(client, request.account.id); const quota = await service.dailyQuota(client, request.account.id); return row ? { defense: { accountId: row.account_id, rating: row.rating, battlesWon: row.battles_won, battlesLost: row.battles_lost }, snapshot: row.snapshot, ...quota } : { defense: null, ...quota }; } finally { client.release(); } });
  app.put("/defense", action(ARENA_DEFENSE_DTO_SCHEMA, (request) => service.setDefense(request.account.id, request.body)));
  app.get("/opponents", { preHandler: account }, (request) => service.opponents(request.account.id));
  app.get("/matches", { preHandler: account }, (request) => service.history(request.account.id, request.query?.limit));
  app.post("/matches", { preHandler: [origin, account], schema: { body: ARENA_MATCH_DTO_SCHEMA } }, async (request, reply) => {
    try { return reply.code(201).send(await service.start(request.account.id, request.body)); }
    catch (error) { if (!(error instanceof ArenaError)) throw error; return reply.code(error.statusCode).send({ code: error.code, message: error.message }); }
  });
  app.post("/matches/:id/settle", action(EMPTY_DTO_SCHEMA, (request) => service.settle(request.account.id, request.params.id)));
  app.get("/matches/:id", { preHandler: account }, (request, reply) => service.replay(request.account.id, request.params.id).catch((error) => { if (!(error instanceof ArenaError)) throw error; return reply.code(error.statusCode).send({ code: error.code, message: error.message }); }));
}
