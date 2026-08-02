const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const connectDB = require("../db");

const { User } = require("../models/user");
const BloodReport = require("../models/bloodReport");
const UrineReport = require("../models/urineReport");
const StoolReport = require("../models/stoolReport");
const bcrypt = require("bcrypt");

async function seed() {
    try {
        await connectDB();

        // Check if test user exists
        let user = await User.findOne({ email: "test@medinsight.com" });
        if (!user) {
            const salt = await bcrypt.genSalt(10);
            const hashPassword = await bcrypt.hash("Password123!", salt);
            user = new User({
                firstName: "Test",
                lastName: "User",
                email: "test@medinsight.com",
                password: hashPassword,
                age: 30,
                height: "175 cm",
                weight: "70 kg",
                sex: "Male",
                settings: {
                    theme: "light",
                    emailAlerts: true,
                    aiInsights: true,
                    autoAnomaly: true
                }
            });
            await user.save();
            console.log("Created test user: test@medinsight.com / Password123!");
        } else {
            console.log("Test user already exists.");
        }

        const userId = user._id;

        // Clear existing reports for this user
        await BloodReport.deleteMany({ userId });
        await UrineReport.deleteMany({ userId });
        await StoolReport.deleteMany({ userId });

        // Add a blood report
        const bloodReport = new BloodReport({
            userId,
            reportDate: new Date(),
            description: "Routine checkup",
            biomarkers: [
                {
                    name: "Hemoglobin",
                    description: "Protein in red blood cells that carries oxygen",
                    result: 14.2,
                    unit: "g/dL",
                    referenceRange: { min: 13.5, max: 17.5 },
                    status: "Normal"
                },
                {
                    name: "White Blood Cell (WBC)",
                    description: "Cells of the immune system involved in defending the body",
                    result: 11.5,
                    unit: "10^3/uL",
                    referenceRange: { min: 4.5, max: 11.0 },
                    status: "High"
                },
                {
                    name: "Platelets",
                    description: "Cells that help blood clot",
                    result: 135,
                    unit: "10^3/uL",
                    referenceRange: { min: 150, max: 450 },
                    status: "Low"
                },
                {
                    name: "Fasting Blood Sugar",
                    description: "Measures blood glucose after an overnight fast",
                    result: 98,
                    unit: "mg/dL",
                    referenceRange: { min: 70, max: 100 },
                    status: "Normal"
                },
                {
                    name: "Total Cholesterol",
                    description: "Total amount of cholesterol in your blood",
                    result: 202,
                    unit: "mg/dL",
                    referenceRange: { min: 100, max: 199 },
                    status: "High"
                }
            ]
        });
        await bloodReport.save();
        console.log("Blood report seeded successfully.");

        // Add a urine report
        const urineReport = new UrineReport({
            userId,
            reportDate: new Date(),
            description: "Urine routine",
            biomarkers: [
                {
                    name: "Urine Color",
                    description: "Color of urine",
                    result: "Pale Yellow",
                    unit: "",
                    referenceRange: { min: "Pale Yellow", max: "Straw" },
                    status: "Normal"
                },
                {
                    name: "Urine Glucose",
                    description: "Glucose level in urine",
                    result: "Negative",
                    unit: "",
                    referenceRange: { min: "Negative", max: "Negative" },
                    status: "Normal"
                },
                {
                    name: "Urine Protein",
                    description: "Protein level in urine",
                    result: "Trace",
                    unit: "",
                    referenceRange: { min: "Negative", max: "Negative" },
                    status: "High"
                }
            ]
        });
        await urineReport.save();
        console.log("Urine report seeded successfully.");

    } catch (err) {
        console.error("Seeding error:", err);
    } finally {
        await mongoose.disconnect();
        console.log("MongoDB disconnected.");
    }
}

seed();
