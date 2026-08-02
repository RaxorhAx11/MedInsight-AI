const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const loadEnv = () => {
	let nodeEnv = process.env.NODE_ENV;

	// Attempt to determine NODE_ENV from fallback .env if not already set in process.env
	if (!nodeEnv) {
		try {
			const envPath = path.resolve(__dirname, "../.env");
			if (fs.existsSync(envPath)) {
				const envConfig = dotenv.parse(fs.readFileSync(envPath));
				nodeEnv = envConfig.NODE_ENV;
			}
		} catch (e) {
			// Ignore read errors
		}
	}

	nodeEnv = nodeEnv || "development";
	process.env.NODE_ENV = nodeEnv;

	// Load environment-specific file first (takes priority)
	const specificEnvPath = path.resolve(__dirname, `../.env.${nodeEnv}`);
	if (fs.existsSync(specificEnvPath)) {
		dotenv.config({ path: specificEnvPath });
	}

	// Load fallback generic .env
	const fallbackEnvPath = path.resolve(__dirname, "../.env");
	if (fs.existsSync(fallbackEnvPath)) {
		dotenv.config({ path: fallbackEnvPath });
	}
};

loadEnv();
