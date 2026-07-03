import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import { createServer } from "http";
import net from "net";
import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { nanoid } from "nanoid";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerAuthRoutes } from "./auth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { ENV } from "./env";
import { logger } from "./logger";
import { register, httpRequestsTotal, httpRequestDurationMs } from "./metrics";
import { startAnalyticsSync } from "../analyticsSync";
import { startAlertEvaluator } from "../alertEvaluator";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => { server.close(() => resolve(true)); });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

// ─── Rate limiters ────────────────────────────────────────────────────────────

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
  skip: () => process.env.NODE_ENV === "test",
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
  skip: () => process.env.NODE_ENV === "test",
});

// ─── Origin validation (CSRF mitigation for cookie-based auth) ────────────────

function buildAllowedOrigins(): Set<string> {
  const origins = new Set<string>();
  if (ENV.appUrl) origins.add(ENV.appUrl.replace(/\/$/, ""));
  ENV.allowedOrigins.forEach(o => origins.add(o));
  return origins;
}

function originCheckMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
  if (!ENV.isProduction) return next();

  const origin = req.headers.origin ?? req.headers.referer ?? "";
  const allowed = buildAllowedOrigins();

  if (allowed.size === 0) return next();

  const originBase = origin.split("/").slice(0, 3).join("/");
  if (!allowed.has(originBase)) {
    res.status(403).json({ error: "Cross-origin request rejected" });
    return;
  }
  next();
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Security headers — must be first
  app.use(helmet({
    contentSecurityPolicy: ENV.isProduction ? undefined : false,
    crossOriginEmbedderPolicy: false,
  }));

  // CORS — must come before other middleware
  const corsOrigins = buildAllowedOrigins();
  app.use(cors({
    origin: corsOrigins.size > 0
      ? (origin, cb) => {
          if (!origin || corsOrigins.has(origin)) return cb(null, true);
          cb(new Error("Not allowed by CORS"));
        }
      : !ENV.isProduction, // in dev with no origins configured, allow all
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }));

  // Structured request logging
  app.use(pinoHttp({
    logger,
    genReqId: () => nanoid(12),
    customLogLevel: (_req, res) => {
      if (res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
    redact: ["req.headers.cookie", "req.headers.authorization"],
    autoLogging: {
      // Skip health check and metrics noise
      ignore: (req) => req.url === "/api/trpc/system.health" || req.url === "/metrics",
    },
  }));

  // Prometheus metrics (internal, no rate-limit needed)
  app.get("/metrics", async (_req, res) => {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  });

  // Instrument all API routes
  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    const end = httpRequestDurationMs.startTimer({ method: req.method, route: req.path });
    res.on("finish", () => {
      httpRequestsTotal.inc({ method: req.method, route: req.path, status: String(res.statusCode) });
      end();
    });
    next();
  });

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // Origin check before any authenticated endpoint
  app.use("/api", originCheckMiddleware);

  // Rate limiting
  app.use("/api/auth", authLimiter);
  app.use("/api/trpc", apiLimiter);

  registerStorageProxy(app);
  registerAuthRoutes(app);

  app.use(
    "/api/trpc",
    createExpressMiddleware({ router: appRouter, createContext })
  );

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  if (ENV.isProduction && !ENV.appUrl) {
    logger.warn("[startup] APP_URL is not set. Origin validation is disabled.");
  }

  const preferredPort = parseInt(process.env.PORT ?? "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) logger.info(`Port ${preferredPort} is busy, using port ${port} instead`);
  server.listen(port, () => {
    logger.info({ port }, `Server running on http://localhost:${port}/`);
    startAnalyticsSync();
    startAlertEvaluator();
  });
}

startServer().catch(err => { logger.fatal(err, "Server failed to start"); process.exit(1); });
