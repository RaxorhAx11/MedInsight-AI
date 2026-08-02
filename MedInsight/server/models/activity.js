const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema({
	userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
	activityType: { type: String, enum: ["upload", "analysis", "alert", "delete", "profile", "settings"], required: true },
	title: { type: String, required: true },
	description: { type: String, required: true },
	status: { type: String, enum: ["Completed", "Processing", "Failed", "Warning"], default: "Completed" },
	createdAt: { type: Date, default: Date.now }
});

activitySchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Activity", activitySchema);
