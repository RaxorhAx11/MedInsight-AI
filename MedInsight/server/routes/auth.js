const router = require("express").Router();
const { User } = require("../models/user");
const bcrypt = require("bcrypt");
const Joi = require("joi");
const rateLimiter = require("../middleware/rateLimiter");

router.post("/", rateLimiter(50), async (req, res) => {
	try {
		const { error, value } = validate(req.body);
		if (error)
			return res.status(400).send({ message: error.details[0].message });

		const email = value.email;
		const user = await User.findOne({ email });

		let passwordMatch = false;
		if (user) {
			passwordMatch = await bcrypt.compare(req.body.password, user.password);
		} else {
			// Dummy compare to mitigate username/email enumeration via timing attacks
			await bcrypt.compare(req.body.password, "$2b$10$A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3X4Y5Z6a");
		}

		if (!user || !passwordMatch)
			return res.status(401).send({ message: "Invalid Email or Password" });

		const token = user.generateAuthToken();
		res.status(200).send({ data: token, message: "logged in successfully" });
	} catch (error) {
		console.error("Login error:", error);
		res.status(500).send({ message: "Internal Server Error" });
	}
});

const validate = (data) => {
	const schema = Joi.object({
		email: Joi.string().email().trim().lowercase().required().label("Email"),
		password: Joi.string().required().label("Password"),
	});
	return schema.validate(data);
};

module.exports = router;

