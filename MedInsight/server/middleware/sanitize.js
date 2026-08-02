const sanitizeString = (str) => {
	if (typeof str !== "string") return str;
	// 1. Strip script tags and their inner content completely
	let sanitized = str.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, "");
	// 2. Strip all other HTML tags
	sanitized = sanitized.replace(/<[^>]*>/g, "");
	return sanitized.trim();
};

const sanitizeObject = (obj) => {
	if (obj === null || typeof obj !== "object") {
		return typeof obj === "string" ? sanitizeString(obj) : obj;
	}
	if (Array.isArray(obj)) {
		return obj.map(sanitizeObject);
	}
	const sanitized = {};
	for (const key in obj) {
		if (Object.prototype.hasOwnProperty.call(obj, key)) {
			sanitized[key] = sanitizeObject(obj[key]);
		}
	}
	return sanitized;
};

module.exports = (req, res, next) => {
	if (req.body) req.body = sanitizeObject(req.body);
	if (req.query) req.query = sanitizeObject(req.query);
	if (req.params) req.params = sanitizeObject(req.params);
	next();
};
