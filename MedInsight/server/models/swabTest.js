const mongoose = require("mongoose");
const createGenericReportSchema = require("./genericReportSchema");

const SwabTest = mongoose.model("SwabTest", createGenericReportSchema());

module.exports = SwabTest;
