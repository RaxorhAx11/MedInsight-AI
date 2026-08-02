const mongoose = require("mongoose");

const createGenericReportSchema = () => {
    const referenceRangeSchema = new mongoose.Schema({
        min: { type: mongoose.Schema.Types.Mixed, required: false },
        max: { type: mongoose.Schema.Types.Mixed, required: false },
    });

    const biomarkerSchema = new mongoose.Schema({
        name: { type: String, required: true }, // Name of the biomarker
        description: { type: String, required: true }, // Description of the biomarker
        result: { type: mongoose.Schema.Types.Mixed, required: true }, // The test result (Mixed for numeric and string values)
        unit: { type: String, required: false }, // Unit of measurement
        referenceRange: { type: referenceRangeSchema, required: false }, // Normal range
        status: { type: String, required: false }, // Status (Normal/High/Low)
    });

    const schema = new mongoose.Schema({
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
        reportDate: { type: Date, required: true },
        biomarkers: { type: [biomarkerSchema], required: true },
        description: { type: String, required: false },
        fileId: { type: mongoose.Schema.Types.ObjectId, ref: "File", required: false },
    });

    schema.index({ userId: 1, reportDate: -1 });
    schema.index({ userId: 1, fileId: 1 });

    return schema;
};

module.exports = createGenericReportSchema;
