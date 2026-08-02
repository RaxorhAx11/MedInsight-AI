const router = require("express").Router();
const authMiddleware = require("../middleware/auth");
const Joi = require("joi");
const Activity = require("../models/activity");
const { File } = require("../models/file");
const BloodReport = require("../models/bloodReport");
const UrineReport = require("../models/urineReport");
const StoolReport = require("../models/stoolReport");
const SemenAnalysis = require("../models/semenAnalysis");
const PapSmear = require("../models/papSmear");
const SwabTest = require("../models/swabTest");
const { logActivity } = require("../services/activityService");

// GET all activities for a user
router.get("/", authMiddleware, async (req, res) => {
	try {
		const userId = req.user._id;
		console.log(`[ACTIVITIES ROUTE] Fetching activities for user: ${userId}`);

		// 1. Check if activities need to be auto-seeded (user has reports but no logged activities)
		const hasUploadActivities = await Activity.exists({ userId, activityType: "upload" });
		if (!hasUploadActivities) {
			const files = await File.find({ userId }).sort({ uploadDate: 1 });
			if (files.length > 0) {
				const reportModels = [
					{ model: BloodReport, type: "Blood" },
					{ model: UrineReport, type: "Urine" },
					{ model: StoolReport, type: "Stool" },
					{ model: SemenAnalysis, type: "Semen Analysis" },
					{ model: PapSmear, type: "Pap Smear" },
					{ model: SwabTest, type: "Swab Test" }
				];

				for (const file of files) {
					// Seed "Upload" activity
					const fileDate = file.uploadDate || new Date();
					await logActivity(
						userId,
						"upload",
						"Report Uploaded",
						`New report "${file.fileName}" was uploaded successfully.`,
						"Completed",
						fileDate
					);

					// Look for corresponding parsed report
					let matchedReport = null;
					let matchedType = "";
					for (const entry of reportModels) {
						const rep = await entry.model.findOne({ userId, fileId: file._id });
						if (rep) {
							matchedReport = rep;
							matchedType = entry.type;
							break;
						}
					}

					// If no match by direct fileId, try matching by date window (+/- 24 hours)
					if (!matchedReport) {
						const minDate = new Date(fileDate.getTime() - 24 * 60 * 60 * 1000);
						const maxDate = new Date(fileDate.getTime() + 24 * 60 * 60 * 1000);
						
						for (const entry of reportModels) {
							const rep = await entry.model.findOne({ 
								userId, 
								reportDate: { $gte: minDate, $lte: maxDate }
							});
							if (rep) {
								matchedReport = rep;
								matchedType = entry.type;
								break;
							}
						}
					}

					if (matchedReport) {
						const formattedDate = new Date(matchedReport.reportDate).toLocaleDateString();
						// Seed "Analysis" activity
						await logActivity(
							userId,
							"analysis",
							"AI Analysis Completed",
							`AI analysis completed for ${matchedType} report (dated ${formattedDate}).`,
							"Completed",
							new Date(fileDate.getTime() + 1000)
						);

						// Scan for out-of-range biomarkers
						const outOfRange = (matchedReport.biomarkers || []).filter(
							b => b.status === "High" || b.status === "Low"
						);
						if (outOfRange.length > 0) {
							const listStr = outOfRange.map(b => `${b.name} (${b.result} - ${b.status})`).join(", ");
							// Seed "Alert" activity
							await logActivity(
								userId,
								"alert",
								"Health Alert Generated",
								`Abnormal biomarker values detected in your ${matchedType} report: ${listStr}`,
								"Warning",
								new Date(fileDate.getTime() + 2000)
							);
						}
					}
				}
			}
		}

		// 2. Fetch activities based on query parameters (filter by type if requested)
		const query = { userId };
		if (req.query.type) {
			query.activityType = req.query.type;
		}

		// Fetch all user activities, sorted newest first
		const activities = await Activity.find(query).sort({ createdAt: -1 });
		res.status(200).send(activities);
	} catch (err) {
		console.error("Error fetching activities:", err);
		res.status(500).json({ message: "Internal Server Error" });
	}
});

const validateActivity = (data) => {
	const schema = Joi.object({
		activityType: Joi.string().valid("upload", "analysis", "alert", "settings", "profile", "delete").required().label("Activity Type"),
		title: Joi.string().trim().max(100).required().label("Title"),
		description: Joi.string().trim().max(500).required().label("Description"),
		status: Joi.string().valid("Completed", "Warning", "Error", "Pending").optional().label("Status")
	});
	return schema.validate(data);
};

// POST log custom activity manually (in case we need it)
router.post("/", authMiddleware, async (req, res) => {
	try {
		const userId = req.user._id;
		const { error, value } = validateActivity(req.body);
		if (error) {
			return res.status(400).send({ message: error.details[0].message });
		}
		const { activityType, title, description, status } = value;
		const activity = await logActivity(userId, activityType, title, description, status || "Completed");
		res.status(201).send(activity);
	} catch (err) {
		console.error("Error logging manual activity:", err);
		res.status(500).json({ message: "Internal Server Error" });
	}
});

module.exports = router;
