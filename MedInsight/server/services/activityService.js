const Activity = require("../models/activity");

/**
 * Log a user activity in the persistent database.
 * @param {string} userId - The user's ID
 * @param {string} activityType - Type of activity (upload, analysis, alert, delete, profile, settings)
 * @param {string} title - Human-readable title of the activity
 * @param {string} description - Description of what occurred
 * @param {string} status - Badge status (Completed, Processing, Failed, Warning)
 * @param {Date} [createdAt] - Optional specific date (useful for historical seeding)
 * @returns {Promise<Object>} The saved activity document
 */
const logActivity = async (userId, activityType, title, description, status = "Completed", createdAt = null) => {
	try {
		const activityData = {
			userId,
			activityType,
			title,
			description,
			status
		};
		if (createdAt) {
			activityData.createdAt = new Date(createdAt);
		}
		
		const activity = new Activity(activityData);
		await activity.save();
		return activity;
	} catch (err) {
		console.error("Error logging user activity:", err);
	}
};

module.exports = {
	logActivity
};
