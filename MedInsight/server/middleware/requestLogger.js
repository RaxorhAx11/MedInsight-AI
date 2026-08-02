const { logger } = require("../utils/logger");

const requestLogger = (req, res, next) => {
	const startTime = process.hrtime();

	res.on("finish", () => {
		const diff = process.hrtime(startTime);
		const durationInMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);

		const logData = {
			method: req.method,
			url: req.originalUrl || req.url,
			status: res.statusCode,
			durationMs: parseFloat(durationInMs),
			ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
			userAgent: req.get("user-agent"),
			contentLength: res.get("content-length")
		};

		if (res.statusCode >= 500) {
			logger.error(`HTTP ${req.method} ${logData.url} failed with status ${res.statusCode}`, logData);
		} else if (res.statusCode >= 400) {
			logger.warn(`HTTP ${req.method} ${logData.url} returned status ${res.statusCode}`, logData);
		} else {
			logger.info(`HTTP ${req.method} ${logData.url} completed with status ${res.statusCode}`, logData);
		}
	});

	next();
};

module.exports = requestLogger;
