const mongoose = require("mongoose");
const createGenericReportSchema = require("./genericReportSchema");

const SemenAnalysis = mongoose.model("SemenAnalysis", createGenericReportSchema());

module.exports = SemenAnalysis;
