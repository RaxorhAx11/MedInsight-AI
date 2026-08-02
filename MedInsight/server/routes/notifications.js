const router = require("express").Router();
const Notification = require("../models/notification");
const authMiddleware = require("../middleware/auth");
const Joi = require("joi");

// GET all notifications for a user
router.get("/", authMiddleware, async (req, res) => {
	try {
		const userId = req.user._id;
		const notifications = await Notification.find({ userId }).sort({ createdAt: -1 });
		res.status(200).send(notifications);
	} catch (err) {
		console.error("Error fetching notifications:", err);
		res.status(500).json({ message: "Internal Server Error" });
	}
});

// PUT mark a notification as read
router.put("/:id/read", authMiddleware, async (req, res) => {
	const { error } = Joi.string().hex().length(24).required().validate(req.params.id);
	if (error) {
		return res.status(400).send({ message: "Invalid Notification ID format" });
	}

	try {
		const notification = await Notification.findOneAndUpdate(
			{ _id: req.params.id, userId: req.user._id },
			{ read: true },
			{ new: true }
		);
		if (!notification) return res.status(404).json({ message: "Notification not found" });
		res.status(200).send(notification);
	} catch (err) {
		console.error("Error marking notification as read:", err);
		res.status(500).json({ message: "Internal Server Error" });
	}
});

// PUT mark all notifications as read
router.put("/read-all", authMiddleware, async (req, res) => {
	try {
		await Notification.updateMany({ userId: req.user._id }, { read: true });
		res.status(200).send({ message: "All notifications marked as read" });
	} catch (err) {
		console.error("Error marking all notifications as read:", err);
		res.status(500).json({ message: "Internal Server Error" });
	}
});

// DELETE a notification (dismiss)
router.delete("/:id", authMiddleware, async (req, res) => {
	const { error } = Joi.string().hex().length(24).required().validate(req.params.id);
	if (error) {
		return res.status(400).send({ message: "Invalid Notification ID format" });
	}

	try {
		const result = await Notification.deleteOne({ _id: req.params.id, userId: req.user._id });
		if (result.deletedCount === 0) return res.status(404).json({ message: "Notification not found" });
		res.status(200).send({ message: "Notification dismissed successfully" });
	} catch (err) {
		console.error("Error dismissing notification:", err);
		res.status(500).json({ message: "Internal Server Error" });
	}
});

// DELETE all notifications (clear)
router.delete("/", authMiddleware, async (req, res) => {
	try {
		await Notification.deleteMany({ userId: req.user._id });
		res.status(200).send({ message: "All notifications cleared" });
	} catch (err) {
		console.error("Error clearing all notifications:", err);
		res.status(500).json({ message: "Internal Server Error" });
	}
});

module.exports = router;
