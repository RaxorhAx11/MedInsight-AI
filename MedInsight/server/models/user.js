const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const Joi = require("joi");
const passwordComplexity = require("joi-password-complexity");

// Define the user schema with additional fields
const userSchema = new mongoose.Schema({
	firstName: { type: String, required: true },
	lastName: { type: String, required: true },
	email: { type: String, required: true, unique: true, lowercase: true, trim: true },
	password: { type: String, required: true },
	age: { type: Number, required: true },
	height: { type: String, required: true },
	weight: { type: String, required: true },
	sex: { type: String, enum: ["Male", "Female", "Other"], required: true },
	settings: {
		theme: { type: String, default: "light" },
		emailAlerts: { type: Boolean, default: true },
		aiInsights: { type: Boolean, default: true },
		autoAnomaly: { type: Boolean, default: true }
	},
	avatar: { type: String, default: "" }
});

// Method to generate authentication token
userSchema.methods.generateAuthToken = function () {
	const privateKey = process.env.JWTPRIVATEKEY;
	if (!privateKey) {
		throw new Error("JWTPRIVATEKEY environment variable is not defined.");
	}
	const expiresIn = process.env.JWT_EXPIRATION || "7d";
	const token = jwt.sign({ _id: this._id }, privateKey, {
		algorithm: "HS256",
		expiresIn,
	});
	return token;
};

// Create the User model
const User = mongoose.model("user", userSchema);

// Joi validation schema for request data
const validate = (data) => {
	const complexityOptions = {
		min: 8,
		max: 128,
		lowerCase: 1,
		upperCase: 1,
		numeric: 1,
		symbol: 1,
		requirementCount: 5,
	};
	const schema = Joi.object({
		firstName: Joi.string().trim().required().label("First Name"),
		lastName: Joi.string().trim().required().label("Last Name"),
		email: Joi.string().email().trim().lowercase().required().label("Email"),
		password: passwordComplexity(complexityOptions).required().label("Password"),
		age: Joi.number().min(0).required().label("Age"),
		height: Joi.string().trim().required().label("Height"),
		weight: Joi.string().trim().required().label("Weight"),
		sex: Joi.string()
			.valid("Male", "Female", "Other")
			.required()
			.label("Sex"),
	});
	return schema.validate(data);
};

module.exports = { User, validate };

