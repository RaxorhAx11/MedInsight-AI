const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
require("../utils/envLoader");

// Determine directories
const backupsDir = path.join(__dirname, "../backups");
const uploadsDir = path.join(__dirname, "../uploads");

// Create timestamp
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupName = `backup-${timestamp}`;
const backupPath = path.join(backupsDir, backupName);

console.log(`Starting backup operation for ${backupName}...`);

// Ensure backups directory exists
if (!fs.existsSync(backupsDir)) {
	fs.mkdirSync(backupsDir, { recursive: true });
}

// Create backup path
fs.mkdirSync(backupPath, { recursive: true });

// 1. Run MongoDB Dump
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
	console.error("Error: MONGODB_URI is not defined in environment variables.");
	process.exit(1);
}

// Mask username and password in connection string for safe log outputs
const maskedUri = mongoUri.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@");
console.log(`Dumping database from URI: ${maskedUri}`);

const dumpCmd = `mongodump --uri="${mongoUri}" --out="${path.join(backupPath, "database")}"`;

exec(dumpCmd, (error, stdout, stderr) => {
	if (error) {
		console.warn("\n========================================================");
		console.warn(`Database dump failed or returned warning: ${error.message}`);
		console.warn("Please ensure MongoDB Database Tools (mongodump) is installed and added to your system PATH.");
		console.warn("If you are using MongoDB Atlas, it is recommended to enable managed automated backups instead.");
		console.warn("========================================================\n");
	} else {
		console.log("Database dump completed successfully.");
	}

	// 2. Backup Uploads Directory
	if (fs.existsSync(uploadsDir)) {
		console.log("Backing up local uploads directory...");
		const backupUploadsDir = path.join(backupPath, "uploads");
		
		try {
			if (fs.cpSync) {
				fs.cpSync(uploadsDir, backupUploadsDir, { recursive: true });
			} else {
				// Fallback recursive copy for older Node versions
				const copyRecursive = (src, dest) => {
					const exists = fs.existsSync(src);
					const stats = exists && fs.statSync(src);
					const isDirectory = exists && stats.isDirectory();
					if (isDirectory) {
						fs.mkdirSync(dest, { recursive: true });
						fs.readdirSync(src).forEach((child) => {
							copyRecursive(path.join(src, child), path.join(dest, child));
						});
					} else {
						fs.copyFileSync(src, dest);
					}
				};
				copyRecursive(uploadsDir, backupUploadsDir);
			}
			console.log("Uploads directory backup completed successfully.");
		} catch (err) {
			console.error(`Failed to backup uploads directory: ${err.message}`);
		}
	} else {
		console.log("No local uploads directory found to backup.");
	}

	console.log(`Backup process finished. Saved to: ${backupPath}`);
});
