require("./utils/envLoader");
const { logger, overrideConsole } = require("./utils/logger");

// Override console methods in production or if explicitly configured
if (process.env.NODE_ENV === "production" || process.env.OVERRIDE_CONSOLE === "true") {
	overrideConsole();
}


// Startup validation for critical configuration variables
const requiredEnv = ["MONGODB_URI", "JWTPRIVATEKEY", "GEMINI_API_KEY"];
requiredEnv.forEach((envVar) => {
	const val = process.env[envVar];
	if (!val || val.trim() === "") {
		console.error("\n========================================================");
		console.error(`FATAL CONFIGURATION ERROR: ${envVar} is not defined in environment variables.`);
		console.error("========================================================\n");
		process.exit(1);
	}
	if (envVar === "GEMINI_API_KEY" && val.trim() === "your_google_gemini_api_key") {
		console.warn("\n========================================================");
		console.warn("WARNING: GEMINI_API_KEY is a placeholder in environment variables. Gemini calls will fail.");
		console.warn("========================================================\n");
	}
});

// Require CLIENT_URL in production environment
if (process.env.NODE_ENV === "production") {
	if (!process.env.CLIENT_URL || process.env.CLIENT_URL.trim() === "") {
		console.error("\n========================================================");
		console.error("FATAL CONFIGURATION ERROR: CLIENT_URL must be defined in environment variables when running in production.");
		console.error("========================================================\n");
		process.exit(1);
	}
}

const express = require("express");
const fs = require("fs");
const path = require("path");
const compression = require("compression");
const app = express();
const cors = require("cors");
const helmet = require("helmet");
const rateLimiter = require("./middleware/rateLimiter");
const sanitizeMiddleware = require("./middleware/sanitize");
const connection = require("./db");
const userRoutes = require("./routes/users");
const authRoutes = require("./routes/auth");
const fileRoutes = require("./routes/files");
const conversationRoutes = require("./routes/conversations");
const bloodReportRoutes = require("./routes/bloodReports");
const notificationRoutes = require("./routes/notifications");
const activityRoutes = require("./routes/activities");
const requestLogger = require("./middleware/requestLogger");
const healthRoutes = require("./routes/health");


const UrineReport = require("./models/urineReport");
const StoolReport = require("./models/stoolReport");
const SemenAnalysis = require("./models/semenAnalysis");
const PapSmear = require("./models/papSmear");
const SwabTest = require("./models/swabTest");
const createGenericReportRouter = require("./routes/genericReportRouter");

// database connection
connection();

// middlewares
app.use(compression());
app.use(
	helmet({
		crossOriginResourcePolicy: { policy: "cross-origin" }
	})
);
app.disable("x-powered-by");
app.use(express.json());
app.use(sanitizeMiddleware);

// HTTP Request logging
app.use(requestLogger);

// Health check routes
app.use("/health", healthRoutes);
app.use("/api/health", healthRoutes);


// Global rate limiting
const globalLimiter = rateLimiter(200, 15 * 60 * 1000); // 200 requests per 15 mins per IP
app.use("/api", globalLimiter);

// CORS options setup
const allowedOrigins = process.env.CLIENT_URL
	? process.env.CLIENT_URL.split(",").map(o => o.trim().replace(/\/$/, ""))
	: [];

const corsOptions = {
	origin: function (origin, callback) {
		// Allow requests with no origin (like same-origin, curl, mobile apps, or local scripts)
		if (!origin) return callback(null, true);
		
		const cleanOrigin = origin.replace(/\/$/, "");
		const isAllowed = allowedOrigins.includes(cleanOrigin) || 
			(process.env.NODE_ENV !== "production" && (cleanOrigin === "http://localhost:3000" || cleanOrigin === "http://localhost:5173"));
			
		if (isAllowed) {
			callback(null, true);
		} else {
			callback(new Error("Not allowed by CORS"));
		}
	},
	credentials: true,
};
app.use(cors(corsOptions));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// routes
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/bloodreport", bloodReportRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/activities", activityRoutes);

const urinereportRouter = createGenericReportRouter(UrineReport, "Urine");
const stoolreportRouter = createGenericReportRouter(StoolReport, "Stool");
const semenanalysisRouter = createGenericReportRouter(SemenAnalysis, "Semen Analysis");
const papsmearRouter = createGenericReportRouter(PapSmear, "Pap Smear");
const swabtestRouter = createGenericReportRouter(SwabTest, "Swab Test");

app.use("/api/urinereport", urinereportRouter);
app.use("/api/urineTests", urinereportRouter);

app.use("/api/stoolreport", stoolreportRouter);
app.use("/api/stoolTest", stoolreportRouter);

app.use("/api/semenanalysis", semenanalysisRouter);
app.use("/api/spermAnalysis", semenanalysisRouter);

app.use("/api/papsmear", papsmearRouter);
app.use("/api/papSmears", papsmearRouter);

app.use("/api/swabtest", swabtestRouter);
app.use("/api/swabTest", swabtestRouter);

// Serve frontend static build files if client/build exists
const buildPath = path.join(__dirname, "../client/build");
if (fs.existsSync(buildPath)) {
	app.use(express.static(buildPath, {
		maxAge: "1d",
		setHeaders: (res, filePath) => {
			if (filePath.endsWith(".html")) {
				res.setHeader("Cache-Control", "no-cache");
			} else if (filePath.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$/)) {
				res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
			}
		}
	}));
	app.get("*", (req, res) => {
		res.sendFile(path.join(buildPath, "index.html"));
	});
}

// Global error handling middleware
app.use((err, req, res, next) => {
	logger.error("Unhandled API error occurred", {
		error: err.message,
		stack: err.stack,
		path: req.originalUrl || req.url,
		method: req.method
	});
	const status = err.status || 500;
	// Do not leak stack traces or internal errors to production clients
	const message = process.env.NODE_ENV === "production" && status === 500
		? "Internal Server Error"
		: err.message || "Internal Server Error";
	res.status(status).json({ message });
});

const port = process.env.PORT || 8080;
const server = app.listen(port, () => console.log(`Listening on port ${port}...`));

server.on("error", (error) => {
	if (error.code === "EADDRINUSE") {
		console.error(`\n[Error] Port ${port} is already in use.`);
		console.error(`To resolve this, please terminate the process currently using port ${port}.\n`);
		process.exit(1);
	} else {
		throw error;
	}
});

// Centralized Graceful Shutdown & Uncaught Error Monitoring
const mongoose = require("mongoose");

const gracefulShutdown = (signal) => {
	logger.warn(`Received ${signal}. Starting graceful shutdown...`);
	
	// Stop accepting new connections
	server.close(async () => {
		logger.info("Express server closed. Cleaning up database connections...");
		try {
			await mongoose.connection.close();
			logger.info("Mongoose connection closed cleanly.");
			process.exit(0);
		} catch (err) {
			logger.error("Error closing Mongoose connection on shutdown:", { error: err });
			process.exit(1);
		}
	});

	// Force exit after 10 seconds if graceful shutdown takes too long
	setTimeout(() => {
		logger.error("Forceful shutdown triggered. Graceful timeout exceeded.");
		process.exit(1);
	}, 10000);
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

process.on("uncaughtException", (error) => {
	logger.error("Uncaught Exception thrown:", { error });
	gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason, promise) => {
	logger.error("Unhandled Rejection at Promise:", { reason });
});

