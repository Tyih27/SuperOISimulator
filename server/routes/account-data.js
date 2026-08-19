import {
  ACCOUNT_DELETE_DTO_SCHEMA,
  PASSWORD_CHANGE_DTO_SCHEMA,
} from "../../shared/contracts/v1.js";
import { AuthError, AuthService } from "../services/auth-service.js";
import { AccountRepository } from "../repositories/account-repository.js";

function readSessionToken(request) {
  const signed = request.cookies.sid;
  if (!signed) return null;
  const result = request.unsignCookie(signed);
  return result.valid ? result.value : null;
}

async function sameOrigin(request, reply) {
  const configured = request.server.config.allowedOrigins;
  const origin = `${request.protocol}://${request.host}`;
  const allowed = Array.isArray(configured) && configured.length > 0 ? configured : [origin];
  if (!request.headers.origin || !allowed.includes(request.headers.origin)) {
    return reply.code(403).send({ code: "ORIGIN_FORBIDDEN", message: "Request origin is not allowed" });
  }
}

async function requireAccount(request, reply) {
  const account = await request.server.accountDataAuthService.authenticate(readSessionToken(request));
  if (!account) return reply.code(401).send({ code: "UNAUTHENTICATED", message: "Authentication required" });
  request.account = account;
}

function sendError(reply, error) {
  if (error instanceof AuthError) return reply.code(error.statusCode).send({ code: error.code, message: error.message });
  throw error;
}

function clearCookie(reply, config) {
  reply.setCookie("sid", "", {
    path: "/", httpOnly: true, secure: config.secureCookies ?? config.isProduction === true, sameSite: "lax", signed: true, maxAge: 0,
  });
}

export async function accountDataRoutes(app) {
  const auth = new AuthService(app.db, { sessionTtlMs: app.config.sessionTtlMs });
  const accounts = new AccountRepository(app.db);
  app.decorate("accountDataAuthService", auth);

  app.get("/export", { preHandler: requireAccount }, async (request, reply) => {
    const client = await app.db.connect();
    try {
      await client.query("BEGIN READ ONLY");
      const data = await accounts.exportData(client, request.account.id);
      await client.query("COMMIT");
      reply.header("content-disposition", `attachment; filename=super-oi-${request.account.id}.json`);
      return { exportedAt: new Date().toISOString(), account: request.account, data };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });

  app.post("/password", {
    preHandler: [sameOrigin, requireAccount], schema: { body: PASSWORD_CHANGE_DTO_SCHEMA },
  }, async (request, reply) => {
    try {
      await auth.changePassword(request.account.id, request.body.currentPassword, request.body.newPassword);
      clearCookie(reply, app.config);
      return reply.code(204).send();
    } catch (error) {
      return sendError(reply, error);
    }
  });

  app.delete("/", {
    preHandler: [sameOrigin, requireAccount], schema: { body: ACCOUNT_DELETE_DTO_SCHEMA },
  }, async (request, reply) => {
    try {
      const result = await auth.queueDeletion(request.account.id, request.body.password, {
        retentionDays: app.config.accountDeletionRetentionDays ?? 30,
      });
      clearCookie(reply, app.config);
      return reply.send({ status: "queued", deleteAfter: result.deleteAfter });
    } catch (error) {
      return sendError(reply, error);
    }
  });
}
