const router = require("express").Router();
const { User, validate } = require("../models/user");
const bcrypt = require("bcrypt");
const Joi = require("joi");
const authMiddleware = require("../middleware/auth");
const rateLimiter = require("../middleware/rateLimiter");

const validateSettings = (data) => {
	const schema = Joi.object({
		theme: Joi.string().valid("light", "dark").optional().label("Theme"),
		emailAlerts: Joi.boolean().optional().label("Email Alerts"),
		aiInsights: Joi.boolean().optional().label("AI Insights"),
		autoAnomaly: Joi.boolean().optional().label("Auto Anomaly")
	});
	return schema.validate(data);
};

// Route to create a new user
router.post("/", rateLimiter(20), async (req, res) => {
	try { 
		// Validate request body
		const { error, value } = validate(req.body);
		if (error) return res.status(400).send({ message: error.details[0].message });

		const { firstName, lastName, email, password, age, height, weight, sex } = value;

		// Check if user already exists
		const user = await User.findOne({ email });
		if (user)
			return res.status(409).send({ message: "Email already in use" });

		// Hash the password
		const salt = await bcrypt.genSalt(Number(process.env.SALT) || 10);
		const hashPassword = await bcrypt.hash(password, salt);

		// Create and save the new user (preventing Mass Assignment)
		await new User({
			firstName,
			lastName,
			email,
			password: hashPassword,
			age,
			height,
			weight,
			sex
		}).save();

		res.status(201).send({ message: "User created successfully!" });
	} catch (error) {
		console.error("User creation error:", error);
		res.status(500).send({ message: "Internal Server Error" });
	}
});

// Route to fetch user profile
router.get("/profile", authMiddleware, async (req, res) => {
	try {
        const userId = req.user._id;

		const user = await User.findById(userId).select("-password");
		if (!user) return res.status(404).send({ message: "User not found" });

		// Return user profile data
		res.status(200).send({
			firstName: user.firstName,
			lastName: user.lastName,
			email: user.email,
			age: user.age,
			height: user.height,
			weight: user.weight,
			sex: user.sex,
			settings: user.settings || {
				theme: "light",
				emailAlerts: true,
				aiInsights: true,
				autoAnomaly: true
			},
			avatar: user.avatar || ""
		});
	} catch (err) {
		console.error(err);
		res.status(500).send({ message: "Internal Server Error" });
	}
});


const { createNotification } = require("../services/notificationService");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const avatarUpload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
	fileFilter: (req, file, cb) => {
		const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
		if (allowed.includes(file.mimetype)) {
			cb(null, true);
		} else {
			cb(new Error("Only images (jpeg, png, gif, webp) are allowed"));
		}
	}
});

// Route to update settings
router.put("/profile/settings", authMiddleware, async (req, res) => {
	try {
		const userId = req.user._id;
		const { error, value } = validateSettings(req.body);
		if (error) return res.status(400).send({ message: error.details[0].message });

		const user = await User.findById(userId);
		if (!user) return res.status(404).send({ message: "User not found" });

		user.settings = { ...user.settings, ...value };
		await user.save();

		// Trigger project-related notification and activity log
		await createNotification(userId, "success", "Your system preferences and settings were updated successfully.");

		try {
			const { logActivity } = require("../services/activityService");
			await logActivity(
				userId,
				"settings",
				"Settings Updated",
				"System preferences and settings were updated successfully.",
				"Completed"
			);
		} catch (actErr) {
			console.error("Error logging settings activity:", actErr);
		}

		res.status(200).send(user.settings);
	} catch (err) {
		console.error("Error updating settings:", err);
		res.status(500).send({ message: "Internal Server Error" });
	}
});

// Route to upload profile photo
router.post("/profile/avatar", authMiddleware, (req, res, next) => {
	avatarUpload.single("avatar")(req, res, async (err) => {
		if (err) {
			return res.status(400).send({ message: err.message });
		}
		
		let uploadResult = null;
		try {
			const userId = req.user._id;
			if (!req.file) return res.status(400).send({ message: "No image file provided." });

			const { uploadFile, deleteFile } = require("../services/cloudStorageService");

			try {
				uploadResult = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype, 'avatar');
			} catch (uploadError) {
				console.error("Avatar storage upload failed:", uploadError);
				return res.status(500).send({ message: "Failed to store uploaded avatar." });
			}

			let avatarUrl = uploadResult.url;
			if (!avatarUrl.startsWith("http")) {
				avatarUrl = `${req.protocol}://${req.get('host')}/${uploadResult.url}`;
			}

			const user = await User.findById(userId);
			if (!user) {
				// Clean up uploaded file if user is not found
				try {
					await deleteFile(uploadResult.url, uploadResult.publicId, 'avatar');
				} catch (delErr) {
					console.error("Failed to delete unused avatar file:", delErr);
				}
				return res.status(404).send({ message: "User not found" });
			}

			// Clean up old avatar if exists
			if (user.avatar) {
				let oldPath = user.avatar;
				if (oldPath.startsWith(`${req.protocol}://${req.get('host')}/`)) {
					oldPath = oldPath.replace(`${req.protocol}://${req.get('host')}/`, "");
				}
				if (!oldPath.includes("default")) {
					try {
						await deleteFile(oldPath, null, 'avatar');
					} catch (e) {
						console.error("Failed to delete old avatar file:", e);
					}
				}
			}

			user.avatar = avatarUrl;
			await user.save();

			// Trigger project-related notification and activity log
			await createNotification(userId, "success", "Profile avatar image was successfully uploaded.");

			try {
				const { logActivity } = require("../services/activityService");
				await logActivity(
					userId,
					"profile",
					"Profile Updated",
					"Profile avatar image was successfully uploaded.",
					"Completed"
				);
			} catch (actErr) {
				console.error("Error logging profile activity:", actErr);
			}

			res.status(200).send({ message: "Avatar uploaded successfully", avatarUrl });
		} catch (err) {
			console.error("Error uploading avatar:", err);
			if (uploadResult) {
				try {
					const { deleteFile } = require("../services/cloudStorageService");
					await deleteFile(uploadResult.url, uploadResult.publicId, 'avatar');
				} catch (delErr) {
					console.error("Failed to clean up uploaded avatar on error:", delErr);
				}
			}
			res.status(500).send({ message: err.message || "Internal Server Error" });
		}
	});
});

const validateProfileUpdate = (data) => {
	const schema = Joi.object({
		firstName: Joi.string().trim().required().label("First Name"),
		lastName: Joi.string().trim().required().label("Last Name"),
		age: Joi.number().min(0).required().label("Age"),
		height: Joi.string().trim().required().label("Height"),
		weight: Joi.string().trim().required().label("Weight"),
		sex: Joi.string().valid("Male", "Female", "Other").required().label("Sex"),
	});
	return schema.validate(data);
};

// Route to update user profile
router.put("/profile", authMiddleware, async (req, res) => {
	try {
		const userId = req.user._id;
		const { error, value } = validateProfileUpdate(req.body);
		if (error) return res.status(400).send({ message: error.details[0].message });

		const { firstName, lastName, age, height, weight, sex } = value;

		const user = await User.findById(userId);
		if (!user) return res.status(404).send({ message: "User not found" });

		user.firstName = firstName;
		user.lastName = lastName;
		user.age = age;
		user.height = height;
		user.weight = weight;
		user.sex = sex;

		await user.save();

		// Trigger notifications and activities
		await createNotification(userId, "success", "Your health profile was successfully updated.");

		try {
			const { logActivity } = require("../services/activityService");
			await logActivity(
				userId,
				"profile",
				"Profile Updated",
				"Your baseline health information was successfully updated.",
				"Completed"
			);
		} catch (actErr) {
			console.error("Error logging profile update activity:", actErr);
		}

		res.status(200).send({
			message: "Profile updated successfully!",
			user: {
				firstName: user.firstName,
				lastName: user.lastName,
				email: user.email,
				age: user.age,
				height: user.height,
				weight: user.weight,
				sex: user.sex,
				avatar: user.avatar
			}
		});
	} catch (err) {
		console.error("Error updating profile:", err);
		res.status(500).send({ message: "Internal Server Error" });
	}
});

module.exports = router;
