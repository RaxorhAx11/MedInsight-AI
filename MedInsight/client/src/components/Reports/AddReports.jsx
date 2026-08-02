import React, { useState } from "react";
import styles from "./addreports.module.css";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Navbar from "../Navbar";
import { 
	FaChevronLeft, 
	FaUpload
} from "react-icons/fa";
import apiurl from "../../config/api";

const AddReports = () => {
	const [step, setStep] = useState(1);
	const [screeningType, setScreeningType] = useState("");
	const [testType, setTestType] = useState("");
	const [testDate, setTestDate] = useState("");
	const [additionalInfo, setAdditionalInfo] = useState("");
	const [file, setFile] = useState(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const navigate = useNavigate();

	const inputRef = React.createRef();



	const nextStep = () => setStep((prev) => Math.min(prev + 1, 5));
	const prevStep = () => setStep((prev) => Math.max(prev - 1, 1));

	const onFileChange = (event) => {
		const selectedFile = event.target.files[0];
		if (selectedFile) {
			if (selectedFile.size > 15 * 1024 * 1024) {
				alert("File size must be less than 15MB.");
				return;
			}
			const allowedTypes = ["application/pdf"];
			if (!allowedTypes.includes(selectedFile.type)) {
				alert("Invalid file type. Only PDF files are allowed.");
				return;
			}
			setFile(selectedFile);
		}
	};

	const handleSubmit = async () => {
		if (!file) {
			alert("Please attach a lab report.");
			return;
		}

		setIsSubmitting(true);
		const formData = new FormData();
		formData.append("file", file);
		formData.append("testDate", testDate);
		formData.append("description", additionalInfo);

		try {
			axios.defaults.headers.common['Authorization'] = `Bearer ${localStorage.getItem("token")}`;

			const response = await axios.post(`${apiurl}/files`, formData);
			const biomarkers = response.data.biomarkers;
			const fileId = response.data.fileId;

			const selectedTest = testTypes.find(t => t.type === testType);
			const endpoint = selectedTest ? selectedTest.endpoint : "bloodreport";

			// Generate the report using the biomarker data
			await axios.post(
				`${apiurl}/${endpoint}/`,
				{
					reportDate: new Date(testDate).toISOString(),
					biomarkers: biomarkers,
					description: additionalInfo,
					fileId: fileId
				},
				{
					headers: {
						Authorization: `Bearer ${localStorage.getItem("token")}`
					}
				}
			);

			alert("Report submitted successfully!");
			navigate("/");
		} catch (error) {
			console.error("Submission error:", error);
			if (error.response && error.response.data && error.response.data.message) {
				alert(error.response.data.message);
			} else {
				alert("Error submitting report. Please try again.");
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	const labTypes = [
		{ type: "Lab Test", description: "Includes blood tests, urine tests, Pap smear, semen analysis, and stool tests like FOBT.", enabled: true },
	];

	const testTypes = [
		{ type: "Blood Report", description: "Analyze red/white blood cells, hemoglobin, platelets, and other metabolic biomarkers.", enabled: true, endpoint: "bloodreport" },
		{ type: "Urine Report", description: "Evaluate chemical composition, pH, protein, and other urinary markers.", enabled: true, endpoint: "urinereport" },
		{ type: "Stool Report", description: "Check for gastrointestinal health, occult blood, calprotectin, and pathogens.", enabled: true, endpoint: "stoolreport" },
		{ type: "Semen Analysis", description: "Assess sperm count, motility, morphology, and seminal fluid characteristics.", enabled: true, endpoint: "semenanalysis" },
		{ type: "Pap Smear", description: "Examine cervical cells for abnormalities, dysplasia, and HPV status.", enabled: true, endpoint: "papsmear" },
		{ type: "Swab Test", description: "Identify bacterial or viral pathogens from throat, nasal, or wound cultures.", enabled: true, endpoint: "swabtest" },
	];

	return (
		<div className={styles.main_wrapper}>
			{/* Navbar */}
			<Navbar />

			<div className={styles.container}>
				<div className={styles.card}>
					{/* Header */}
					<div className={styles.header}>
						<button
							className={styles.backIcon}
							onClick={prevStep}
							disabled={step === 1}
							aria-label="Previous step"
						>
							<FaChevronLeft />
						</button>
						<h2>New Report Entry</h2>
					</div>

					{/* Progress Indicator */}
					<div className={styles.progressContainer}>
						<p className={styles.stepCount}>Step {step} of 5</p>
						<div className={styles.progressBar}>
							<div
								className={styles.progress}
								style={{ width: `${(step / 5) * 100}%` }}
							></div>
						</div>
					</div>

					{/* Step 1: File Attach */}
					{step === 1 && (
						<div className={styles.step_content}>
							<div className={styles.instructions}>
								<strong>Please note:</strong> Upload text-based reports (such as blood panels and urinalysis summaries). Image scans (CT, X-rays, MRI) are not currently supported.
							</div>
							
							<div className={styles.fileUploadWrapper}>
								<div className={styles.fileButton}>
									<FaUpload className={styles.upload_icon} />
									<span>
										{file ? file.name : "Choose Report File"}
									</span>
									<input
										type="file"
										name="file"
										className={styles.fileInput}
										ref={inputRef}
										onChange={onFileChange}
										accept=".pdf"
									/>
								</div>
							</div>
							<p className={styles.fileHint}>
								PDF up to 15MB.
							</p>

							<div className={styles.buttons}>
								<button className={styles.backButton} disabled>
									Back
								</button>
								<button
									className={styles.nextButton}
									onClick={nextStep}
									disabled={!file}
								>
									Next
								</button>
							</div>
						</div>
					)}

					{/* Step 2: Screening Type */}
					{step === 2 && (
						<div className={styles.step_content}>
							<h3 className={styles.step_title}>Choose the Screening Type</h3>
							<div className={styles.testOptions}>
								{labTypes.filter(t => t.enabled).map(({ type, description, enabled }) => (
									<button
										key={type}
										onClick={() => enabled && setScreeningType(type)}
										className={`${styles.optionButton} ${screeningType === type ? styles.selected : ""} ${!enabled ? styles.disabled : ""}`}
										disabled={!enabled}
									>
										<div className={styles.testType}>{type}</div>
										<div className={styles.testDescription}>{description}</div>
									</button>
								))}
							</div>
							<div className={styles.buttons}>
								<button className={styles.backButton} onClick={prevStep}>
									Back
								</button>
								<button
									className={styles.nextButton}
									onClick={nextStep}
									disabled={!screeningType}
								>
									Next
								</button>
							</div>
						</div>
					)}

					{/* Step 3: Result Type */}
					{step === 3 && (
						<div className={styles.step_content}>
							<h3 className={styles.step_title}>Choose the Test Result Type</h3>
							<div className={styles.testOptions}>
								{testTypes.map(({ type, description, enabled }) => (
									<button
										key={type}
										onClick={() => enabled && setTestType(type)}
										className={`${styles.optionButton} ${testType === type ? styles.selected : ""} ${!enabled ? styles.disabled : ""}`}
										disabled={!enabled}
									>
										<div className={styles.testType}>{type}</div>
										<div className={styles.testDescription}>{description}</div>
									</button>
								))}
							</div>
							<div className={styles.buttons}>
								<button className={styles.backButton} onClick={prevStep}>
									Back
								</button>
								<button
									className={styles.nextButton}
									onClick={nextStep}
									disabled={!testType}
								>
									Next
								</button>
							</div>
						</div>
					)}

					{/* Step 4: Test Date */}
					{step === 4 && (
						<div className={styles.step_content}>
							<h3 className={styles.step_title}>Select Report Date</h3>
							<p className={styles.step_desc_inline}>Provide the date this test was performed to track biometric changes chronologically.</p>
							
							<div className={styles.input_center_wrapper}>
								<input
									type="date"
									value={testDate}
									onChange={(e) => setTestDate(e.target.value)}
									className={styles.dateInput}
								/>
							</div>

							<div className={styles.buttons}>
								<button className={styles.backButton} onClick={prevStep}>
									Back
								</button>
								<button
									className={styles.nextButton}
									onClick={nextStep}
									disabled={!testDate}
								>
									Next
								</button>
							</div>
						</div>
					)}

					{/* Step 5: Description */}
					{step === 5 && (
						<div className={styles.step_content}>
							<h3 className={styles.step_title}>Additional Context (Optional)</h3>
							<p className={styles.step_desc_inline}>Add any notes, symptoms, or instructions from your practitioner.</p>
							
							<textarea
								className={styles.textArea}
								placeholder="Enter any additional report details here..."
								value={additionalInfo}
								onChange={(e) => setAdditionalInfo(e.target.value)}
							></textarea>

							<div className={styles.buttons}>
								<button className={styles.backButton} onClick={prevStep}>
									Back
								</button>
								<button 
									className={styles.submitButton} 
									onClick={handleSubmit}
									disabled={isSubmitting}
								>
									{isSubmitting ? "Submitting..." : "Submit Report"}
								</button>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default AddReports;
