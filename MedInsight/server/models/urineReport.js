const mongoose = require("mongoose");
const createGenericReportSchema = require("./genericReportSchema");

const UrineReport = mongoose.model("UrineReport", createGenericReportSchema());

module.exports = UrineReport;
