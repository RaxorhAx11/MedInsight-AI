const mongoose = require("mongoose");
const createGenericReportSchema = require("./genericReportSchema");

const BloodReport = mongoose.model("BloodReport", createGenericReportSchema());

module.exports = BloodReport;
