const jwt = require("jsonwebtoken");

module.exports = function (req, res, next) {
	// Get token from Authorization header
	const authHeader = req.header("Authorization") || req.header("authorization");
	if (!authHeader) {
		return res.status(401).json({ message: "Access denied. No token provided." });
	}

	// Verify the Bearer scheme
	if (!authHeader.startsWith("Bearer ")) {
		return res.status(401).json({ message: "Access denied. Invalid token format." });
	}

	const token = authHeader.replace("Bearer ", "").trim();
	if (!token) {
		return res.status(401).json({ message: "Access denied. Token is empty." });
	}

	try {
		const decoded = jwt.verify(token, process.env.JWTPRIVATEKEY, {
			algorithms: ["HS256"]
		});
		req.user = decoded; // Attach decoded token payload (e.g. { _id }) to request
		next();
	} catch (error) {
		if (error.name === "TokenExpiredError") {
			return res.status(401).json({ message: "Token expired. Please log in again." });
		}
		return res.status(401).json({ message: "Invalid authentication token." });
	}
};
