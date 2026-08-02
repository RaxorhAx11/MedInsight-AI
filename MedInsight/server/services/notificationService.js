const Notification = require("../models/notification");
const { User } = require("../models/user");
const fs = require("fs");
const path = require("path");

const createNotification = async (userId, type, message, link = "") => {
	try {
		const notif = new Notification({ userId, type, message, link });
		await notif.save();
		return notif;
	} catch (err) {
		console.error("Error creating notification:", err);
	}
};

const handleBiomarkerAnalysisNotifications = async (userId, reportTypeName, reportDate, biomarkers) => {
	try {
		const user = await User.findById(userId);
		if (!user) return;

		const emailAlertsEnabled = user.settings ? user.settings.emailAlerts : true;
		const formattedDate = new Date(reportDate).toLocaleDateString();

		// 1. Create AI Analysis completed notification and activity log
		await createNotification(
			userId,
			"info",
			`AI analysis completed for ${reportTypeName} report (dated ${formattedDate}).`,
			"/reports"
		);

		try {
			const { logActivity } = require("./activityService");
			await logActivity(
				userId,
				"analysis",
				"AI Analysis Completed",
				`AI analysis completed for ${reportTypeName} report (dated ${formattedDate}).`,
				"Completed",
				reportDate
			);
		} catch (actErr) {
			console.error("Error logging analysis activity:", actErr);
		}

		// 2. Scan for out of range biomarkers
		const outOfRange = biomarkers.filter(b => b.status === "High" || b.status === "Low");

		if (outOfRange.length > 0) {
			const listStr = outOfRange.map(b => `${b.name} (${b.result} ${b.unit} - ${b.status})`).join(", ");
			
			// Create High/Low biomarker notification
			await createNotification(
				userId,
				"warning",
				`Abnormal biomarker values detected in your ${reportTypeName} report: ${listStr}`,
				"/reports/results"
			);

			try {
				const { logActivity } = require("./activityService");
				await logActivity(
					userId,
					"alert",
					"Health Alert Generated",
					`Abnormal biomarker values detected in your ${reportTypeName} report: ${listStr}`,
					"Warning",
					reportDate
				);
			} catch (actErr) {
				console.error("Error logging alert activity:", actErr);
			}

			// Also trigger a critical alert notification
			await createNotification(
				userId,
				"danger",
				`Critical Health Alert: One or more biomarkers are out of range in your ${reportTypeName} report. Please review your results.`,
				"/reports/results"
			);

			// 3. Email Alert logic
			if (emailAlertsEnabled) {
				// Perform simulation and log
				const logDir = path.resolve(__dirname, "../uploads/email_logs");
				if (!fs.existsSync(logDir)) {
					fs.mkdirSync(logDir, { recursive: true });
				}

				const emailBody = `
To: ${user.email}
Subject: MedInsight AI Alert: Abnormal Biomarker Detected
Date: ${new Date().toISOString()}

Dear ${user.firstName} ${user.lastName},

MedInsight AI has finished analyzing your recent ${reportTypeName} report dated ${formattedDate}.

We detected one or more biomarker values that fall outside the standard reference ranges:
${outOfRange.map(b => `- ${b.name}: ${b.result} ${b.unit} (Status: ${b.status} | Reference Range: ${b.referenceRange.min} - ${b.referenceRange.max} ${b.unit})`).join("\n")}

Please log in to your dashboard to review the complete reports and Ask AI consult history:
${process.env.CLIENT_URL || "http://localhost:3000"}/reports/results

Regards,
MedInsight AI Health Team
`;

				const filename = `email-${userId}-${Date.now()}.log`;
				fs.writeFileSync(path.join(logDir, filename), emailBody.trim());

				console.log(`[EMAIL ALERTS] Email simulation log written to uploads/email_logs/${filename}`);

				// Create email dispatch status notification
				await createNotification(
					userId,
					"success",
					`Email notification alert successfully sent to ${user.email}.`,
					""
				);
			} else {
				// Email alert disabled status notification
				await createNotification(
					userId,
					"info",
					`Email alert notification skipped (disabled in Settings) for abnormal biomarker values.`,
					""
				);
			}
		}
	} catch (err) {
		console.error("Error in biomarker analysis notifications:", err);
	}
};

module.exports = {
	createNotification,
	handleBiomarkerAnalysisNotifications
};
