const winston = require("winston");
const path = require("path");
const util = require("util");

const logFormat = winston.format.combine(
	winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
	winston.format.errors({ stack: true }), // Capture stack traces automatically
	winston.format.splat(),
	winston.format.json()
);

const devFormat = winston.format.combine(
	winston.format.colorize(),
	winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
	winston.format.errors({ stack: true }),
	winston.format.printf(({ timestamp, level, message, stack, ...metadata }) => {
		let msg = `${timestamp} [${level}]: ${message}`;
		if (metadata && Object.keys(metadata).length > 0) {
			// Avoid printing empty metadata or internal winston symbols
			const cleanedMeta = { ...metadata };
			delete cleanedMeta[Symbol.for("level")];
			delete cleanedMeta[Symbol.for("message")];
			delete cleanedMeta[Symbol.for("splat")];
			if (Object.keys(cleanedMeta).length > 0) {
				msg += ` ${JSON.stringify(cleanedMeta)}`;
			}
		}
		if (stack) {
			msg += `\n${stack}`;
		}
		return msg;
	})
);

const logger = winston.createLogger({
	level: process.env.LOG_LEVEL || "info",
	format: process.env.NODE_ENV === "production" ? logFormat : devFormat,
	transports: [
		new winston.transports.Console()
	]
});

// In production, add persistent logging to log files
if (process.env.NODE_ENV === "production") {
	const logDir = path.join(__dirname, "../logs");
	logger.add(
		new winston.transports.File({
			filename: path.join(logDir, "error.log"),
			level: "error",
			maxsize: 5242880, // 5MB
			maxFiles: 5,
		})
	);
	logger.add(
		new winston.transports.File({
			filename: path.join(logDir, "combined.log"),
			maxsize: 5242880, // 5MB
			maxFiles: 5,
		})
	);
}

// Utility to override standard console functions with the winston logger
function overrideConsole() {
	const formatArgs = (args) => {
		return args.map(arg => {
			if (arg instanceof Error) {
				return arg.stack || arg.message;
			}
			if (typeof arg === "object") {
				return util.inspect(arg, { depth: null, colors: false });
			}
			return String(arg);
		}).join(" ");
	};

	console.log = (...args) => logger.info(formatArgs(args));
	console.info = (...args) => logger.info(formatArgs(args));
	console.warn = (...args) => logger.warn(formatArgs(args));
	console.debug = (...args) => logger.debug(formatArgs(args));
	console.error = (...args) => {
		const lastArg = args[args.length - 1];
		if (lastArg instanceof Error) {
			logger.error(formatArgs(args.slice(0, -1)), { error: lastArg });
		} else {
			logger.error(formatArgs(args));
		}
	};
}

module.exports = {
	logger,
	overrideConsole
};
