// src/app.ts
import express from "express";
import "dotenv/config";
import parser from "body-parser";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import { errorHandler } from "./utils/errorHandler";


// Routes
import userRouter from "./routes/user";
import engagementRouter from "./routes/engagement";
import leadRouter from "./routes/leads";


import { validateJWT } from "./middlewares/jwtValidator";
import connectToDatabase from "./utils/database";

const app = express();
const port = process.env.PORT || 3000;

// Security Middleware
app.use(helmet()); // Adds various HTTP headers for security

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Logging
app.use(morgan("dev"));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 5 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

app.use((req, res, next) => {
  if (req.path === "/login" || req.path === "/register") {
    return next(); // Skip validation for login/register routes
  }
  validateJWT(req, res, next);
});

// Parsing Middleware
app.use(parser.json());
app.use(parser.urlencoded({ extended: true }));

// Routes
app.use("/api", userRouter);
app.use("/api/user", engagementRouter);
app.use("/api/lead", leadRouter);


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
connectToDatabase().then(() => {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
});

export default app;
