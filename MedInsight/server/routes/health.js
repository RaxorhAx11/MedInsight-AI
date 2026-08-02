const router = require("express").Router();
const mongoose = require("mongoose");
const os = require("os");

router.get("/", async (req, res) => {
	const dbState = mongoose.connection.readyState;
	// mongoose.connection.readyState values:
	// 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
	const dbStatus = dbState === 1 ? "UP" : "DOWN";

	const healthInfo = {
		status: dbStatus === "UP" ? "UP" : "DOWN",
		timestamp: new Date().toISOString(),
		uptime: process.uptime(),
		services: {
			database: {
				status: dbStatus,
				details: {
					readyState: dbState
				}
			}
		},
		system: {
			platform: process.platform,
			arch: process.arch,
			memory: {
				free: os.freemem(),
				total: os.totalmem(),
				usagePercent: (((os.totalmem() - os.freemem()) / os.totalmem()) * 100).toFixed(2)
			},
			cpu: {
				loadavg: os.loadavg()
			}
		}
	};

	if (dbStatus !== "UP") {
		return res.status(503).json(healthInfo);
	}

	res.status(200).json(healthInfo);
});

module.exports = router;
