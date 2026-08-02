const mongoose = require("mongoose");

// Configuration values with defaults
const getMongoConfig = () => {
	const uri = process.env.MONGODB_URI;
	const maxPoolSize = parseInt(process.env.MONGODB_MAX_POOL_SIZE || "10", 10);
	const serverSelectionTimeoutMS = parseInt(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || "5000", 10);
	const socketTimeoutMS = parseInt(process.env.MONGODB_SOCKET_TIMEOUT_MS || "45000", 10);
	const autoIndex = process.env.MONGODB_AUTO_INDEX === "true" || (process.env.NODE_ENV !== "production" && process.env.MONGODB_AUTO_INDEX !== "false");
	const retryAttempts = parseInt(process.env.MONGODB_RETRY_ATTEMPTS || "5", 10);
	const retryDelay = parseInt(process.env.MONGODB_RETRY_DELAY_MS || "5000", 10);

	return {
		uri,
		options: {
			maxPoolSize,
			serverSelectionTimeoutMS,
			socketTimeoutMS,
			autoIndex,
		},
		retryAttempts,
		retryDelay,
	};
};

let connectionAttempts = 0;

const connectDB = async () => {
	const config = getMongoConfig();
	connectionAttempts++;

	// Log attempt details
	console.log(`Connecting to MongoDB (attempt ${connectionAttempts}/${config.retryAttempts})...`);
	
	try {
		await mongoose.connect(config.uri, config.options);
		console.log("Connected to database successfully");
		connectionAttempts = 0; // Reset counter on success
	} catch (error) {
		console.error(`Database connection error (attempt ${connectionAttempts}/${config.retryAttempts}):`, error.message);
		
		if (connectionAttempts < config.retryAttempts) {
			console.log(`Retrying database connection in ${config.retryDelay / 1000}s...`);
			await new Promise(resolve => setTimeout(resolve, config.retryDelay));
			return connectDB();
		} else {
			console.error("Max database connection retry attempts reached. Exiting process.");
			process.exit(1);
		}
	}
};

// Set up connection event listeners (avoid duplicate event listeners if initialized multiple times in tests)
if (mongoose.connection.listenerCount("connected") === 0) {
	mongoose.connection.on("connected", () => {
		console.log("Mongoose connection established successfully");
	});
}
if (mongoose.connection.listenerCount("error") === 0) {
	mongoose.connection.on("error", (err) => {
		console.error("Mongoose connection error occurred:", err);
	});
}
if (mongoose.connection.listenerCount("disconnected") === 0) {
	mongoose.connection.on("disconnected", () => {
		console.warn("Mongoose connection disconnected from database");
	});
}
if (mongoose.connection.listenerCount("reconnected") === 0) {
	mongoose.connection.on("reconnected", () => {
		console.log("Mongoose connection successfully reestablished");
	});
}

module.exports = connectDB;