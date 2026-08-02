const rateLimitWindowMs = 15 * 60 * 1000; // 15 minutes window
const rateLimitMaxRequests = 100; // limit each IP to 100 requests per windowMs

module.exports = function (maxRequests = rateLimitMaxRequests, windowMs = rateLimitWindowMs) {
	const ipRequestMap = new Map();

	// Periodic cleanup of expired entries to prevent memory leaks
	const intervalId = setInterval(() => {
		const now = Date.now();
		for (const [ip, data] of ipRequestMap.entries()) {
			if (now > data.resetTime) {
				ipRequestMap.delete(ip);
			}
		}
	}, 5 * 60 * 1000); // run cleanup every 5 minutes

	return function (req, res, next) {
		const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
		const now = Date.now();

		if (!ipRequestMap.has(ip)) {
			ipRequestMap.set(ip, {
				count: 1,
				resetTime: now + windowMs,
			});
			return next();
		}

		const data = ipRequestMap.get(ip);

		// If the window has passed, reset the counter
		if (now > data.resetTime) {
			data.count = 1;
			data.resetTime = now + windowMs;
			return next();
		}

		// If client has exceeded the limit, return 429
		if (data.count >= maxRequests) {
			return res.status(429).json({
				message: "Too many requests from this IP, please try again in a few minutes."
			});
		}

		data.count += 1;
		next();
	};
};
