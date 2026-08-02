const mongoose = require("mongoose");
const Joi = require("joi");

const fileSchema = new mongoose.Schema({
	userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
	fileName: { type: String, required: true },
	filePath: { type: String, required: true },
	publicId: { type: String, required: false },
	mimetype: { type: String, required: false },
	uploadDate: { type: Date, default: Date.now },
	description: { type: String, required: false },
	testDate: { type: Date, required: false, default: Date.now }
});

fileSchema.index({ userId: 1, testDate: -1 });
fileSchema.index({ userId: 1, uploadDate: -1 });

const File = mongoose.model("File", fileSchema);

const validateFile = (data) => {
	const schema = Joi.object({
		userId: Joi.string().required().label("User ID"),
		fileName: Joi.string().required().label("File Name"),
		filePath: Joi.string().required().label("File Path"),
		publicId: Joi.string().optional().allow('').label("Public ID"),
		mimetype: Joi.string().optional().label("Mime Type"),
		description: Joi.string().allow('').optional().label("Description"),
		testDate: Joi.date().label("Test Date")
	});
  	return schema.validate(data);
};

module.exports = { File, validateFile };
