// src/app.ts
import express from "express";
import "dotenv/config";
import parser from "body-parser";
import cors from "cors";

import rateLimit from "express-rate-limit";
import morgan from "morgan";
import { errorHandler } from "./utils/errorHandler";

// Routes
import userRouter from "./routes/user";
import engagementRouter from "./routes/engagement";
import leadRouter from "./routes/leads";
import settingsRouter from "./routes/settings";
import WhatsAppRouter from "./routes/whatsApp";
import EmailRouter from "./routes/Email";
import ReminderRouter from "./routes/Reminder";
import testRouter from "./routes/testRoutes";
import statusRouter from "./routes/status";
import { validateJWT } from "./middlewares/jwtValidator";
import { fetchClient } from "./middlewares/fetchClient";
import connectToDatabase from "./utils/database";
import multer from "multer";

const app = express();
const port = process.env.PORT || 3000;

// Multer
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(upload.single("file"));

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "client-id"],
  })
);

// Logging
app.use(morgan("dev"));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 5 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
//app.use(limiter);

app.use((req, res, next) => {
  if (
    req.path === "/login" ||
    req.path === "/register" ||
    req.path === "/test"
  ) {
    return next(); // Skip validation for login/register routes
  }
  validateJWT(req, res, next);
});
//app.use(fetchClient);
app.disable("etag");

app.use((req, res, next) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  res.setHeader("ETag", "false"); // Disable ETag for specific routes if needed
  next();
});

// Parsing Middleware
app.use(parser.json());
app.use(parser.urlencoded({ extended: true }));

// Routes
app.use("/api", userRouter);
app.use("/api/engagements", engagementRouter);
app.use("/api/lead", leadRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/whatsapp", WhatsAppRouter);
app.use("/api/email", EmailRouter);
app.use("/api/reminder", ReminderRouter)
app.use("/api/status", statusRouter);

app.use("/test", testRouter);

// Global Error Handler
app.use(errorHandler);

// 404 Handler
app.use((req, res, next) => {
  res.status(404).json({
    status: "error",
    message: "Route not found",
  });
});

// Connect to Database and Start Server
const startServer = (port: number) => {
  app
    .listen(port, () => {
      console.log(`Server running on port ${port}`);
    })
    .on("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        console.log(`Port ${port} in use, trying port ${port + 1}`);
        startServer(port + 1);
      } else {
        console.error(err);
      }
    });
};

process.on("unhandledRejection", (err) => {
  console.error(err);
});

process.on("uncaughtException", (err) => {
  console.error(err);
});

connectToDatabase().then(() => {
  startServer(Number(port));
});

export default app;
