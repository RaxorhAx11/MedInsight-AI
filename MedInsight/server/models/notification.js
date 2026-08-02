const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
	userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
	type: { type: String, enum: ["info", "success", "warning", "danger"], default: "info" },
	message: { type: String, required: true },
	read: { type: Boolean, default: false },
	link: { type: String, default: "" },
	createdAt: { type: Date, default: Date.now }
});

notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
