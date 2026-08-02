import styles from "./styles.module.css";
import axios from "axios";
import { useRef, useState, useEffect } from "react";
import { FiMessageSquare, FiPlus, FiTrash2 } from "react-icons/fi";
import { 
	FaHeartbeat, 
	FaCloudUploadAlt 
} from "react-icons/fa";
import { v4 as uuidv4 } from "uuid";
import { useNavigate } from "react-router-dom";
import BotResponse from "./BotResponse";
import Navbar from "../Navbar";

import {
	ComposedChart,
	Line,
	Area,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	DefaultLegendContent,
} from "recharts";
import apiurl from "../../config/api";

function Chatbot() {
	const [input, setInput] = useState("");
	const [error, setError] = useState("");
	const [showReportSummary, setShowReportSummary] = useState(true);
	const [messages, setMessages] = useState([]);
	const [conversations, setConversations] = useState([]);
	const [conversationID, setConversationID] = useState("");
	const [uploadedReports, setUploadedReports] = useState([]);
	const [selectedReportId, setSelectedReportId] = useState("");
	const inputRef = useRef(null);
	const fileInputRef = useRef(null);
	const navigate = useNavigate();

	useEffect(() => {
		fetchConversations();
		fetchUploadedReports();
		setConversationID(generateConversationID());
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const fetchUploadedReports = async () => {
		try {
			const response = await axios.get(`${apiurl}/conversations/reports`);
			setUploadedReports(response.data.reports || []);
		} catch (error) {
			console.error("Error fetching reports list:", error);
			setError("Failed to load medical reports list.");
		}
	};

	const fetchConversations = async () => {
		try {
			const response = await axios.get(`${apiurl}/conversations/user`);
			setConversations(response.data.conversations);
		} catch (error) {
			if (error.response?.status === 401) {
				handleLogout();
			} else {
				console.error("Error fetching conversations:", error);
				setError("Error fetching conversations");
			}
		}
	};

	const generateConversationID = () => uuidv4().replace(/-/g, "").substring(0, 24);

	const newChat = () => {
		setConversationID(generateConversationID());
		setMessages([]);
	};

	const chatClicks = async (conversationID) => {
		try {
			const response = await axios.get(`${apiurl}/conversations/conversation/${conversationID}`);
			const messages = response.data.map(({ sender, message }) => ({
				sender,
				text: message,
			}));
			setMessages(messages);
			setConversationID(conversationID);
		} catch (error) {
			console.error("Error fetching conversation:", error);
			setError("Error fetching conversation");
		}
	};

	const deleteChat = async (idToDelete) => {
		if (!window.confirm("Are you sure you want to delete this chat?")) return;

		try {
			await axios.delete(`${apiurl}/conversations/conversation/${idToDelete}`);
			
			// Refresh list
			await fetchConversations();

			// If the currently open chat was deleted, reset messages and active ID
			if (conversationID === idToDelete) {
				setMessages([]);
				setConversationID(generateConversationID());
			}
		} catch (error) {
			console.error("Error deleting conversation:", error);
			setError("Failed to delete conversation.");
		}
	};

	const clearAllHistory = async () => {
		if (!window.confirm("Are you sure you want to clear all chat history? This cannot be undone.")) return;

		try {
			await axios.delete(`${apiurl}/conversations/clear`);
			
			setConversations([]);
			setMessages([]);
			setConversationID(generateConversationID());
		} catch (error) {
			console.error("Error clearing all history:", error);
			setError("Failed to clear chat history.");
		}
	};

	const handleLogout = () => {
		localStorage.removeItem("token");
		// Reset authorization default header
		delete axios.defaults.headers.common["Authorization"];
		navigate("/login");
		window.location.reload();
	};

	const fetchBiomarkerData = async (name) => {
		try {
			const endpoints = ["bloodreport", "urinereport", "stoolreport", "semenanalysis", "papsmear", "swabtest"];
			for (const ep of endpoints) {
				try {
					const response = await axios.get(`${apiurl}/${ep}/history/${name}`);
					if (response.data && response.data.length > 0) {
						const history = response.data.map((record) => ({
							date: record.date,
							value: record.value,
							unit: record.unit,
							range: [
								record.normalRange?.min ?? 0,
								record.normalRange?.max ?? 0,
							],
							description: record.description || "No description available",
						}));

						// Add padding data points to extend the chart
						const historyWithPadding = [
							{
								date: "01/01/2000",
								value: null,
								range: history[0]?.range || [0, 0],
							},
							...history,
							{
								date: "12/31/3000",
								value: null,
								range: history[history.length - 1]?.range || [0, 0],
							},
						];

						return historyWithPadding;
					}
				} catch (e) {
					// Ignore and try next endpoint
				}
			}
			return null;
		} catch (err) {
			console.error("Error fetching biomarker data:", err);
			setError("Failed to load biomarker data.");
			return null;
		}
	};



	const sendMessage = async (customText, customReportId) => {
		const textToSend = (typeof customText === "string" ? customText : input).trim();
		if (!textToSend) return;

		const reportIdToSend = customReportId !== undefined ? customReportId : selectedReportId;

		const userMessage = { sender: "user", text: textToSend };
		setMessages((prevMessages) => [...prevMessages, userMessage]);

		setInput("");

		if (textToSend.startsWith("View Results for ")) {
			const biomarkerName = textToSend.replace("View Results for ", "").trim();
			if (!biomarkerName) {
				setMessages((prevMessages) => [
					...prevMessages,
					{ sender: "bot", text: "Please specify a biomarker name." },
				]);
				return;
			}
			try {
				const history = await fetchBiomarkerData(biomarkerName);
				if (history) {
					const chartMessage = { sender: "chart", data: history };
					setMessages((prevMessages) => [...prevMessages, chartMessage]);
				} else {
					setMessages((prevMessages) => [
						...prevMessages,
						{ sender: "bot", text: `No data found for biomarker: ${biomarkerName}` },
					]);
				}
			} catch (err) {
				console.error("Error fetching biomarker data:", err);
				setMessages((prevMessages) => [
					...prevMessages,
					{ sender: "bot", text: "Failed to fetch biomarker data. Please try again later." },
				]);
			}
			return;
		}

		if (!reportIdToSend) {
			setMessages((prevMessages) => [
				...prevMessages,
				{ sender: "bot", text: "Please select a medical report from the dropdown menu above before asking a question." },
			]);
			return;
		}

		try {
			const response = await axios.post(`${apiurl}/conversations/chat`, {
				message: textToSend,
				messages: messages,
				reportId: reportIdToSend,
				conversationID,
				topic: textToSend,
			});

			setMessages((prevMessages) => [
				...prevMessages,
				{ sender: "bot", text: response.data.botResponse },
			]);
		} catch (error) {
			console.error("Error sending message:", error);
			setError("Error sending message");
		}
	};

	const handleInputChange = (e) => setInput(e.target.value);

	const handleKeyPress = (e) => {
		if (e.key === "Enter") sendMessage();
	};

	const clickInput = () => {
		if (fileInputRef.current) {
			fileInputRef.current.click();
		}
	};

	const toggleReportSummary = () => setShowReportSummary(!showReportSummary);

	const onFileChange = async (e) => {
		const file = e.target.files[0];
		if (!file) return;

		if (file.size > 15 * 1024 * 1024) {
			alert("File size must be less than 15MB.");
			return;
		}

		const allowedTypes = ["application/pdf"];
		if (!allowedTypes.includes(file.type)) {
			alert("Invalid file type. Only PDF files are allowed.");
			return;
		}

		setError("");
		const userMessage = { sender: "user", text: `[Uploading report: ${file.name}]` };
		setMessages((prevMessages) => [...prevMessages, userMessage]);

		const formData = new FormData();
		formData.append("file", file);
		formData.append("testDate", new Date().toISOString());
		formData.append("description", `Uploaded via chatbot on ${new Date().toLocaleDateString()}`);

		try {
			// Step 1: Upload and parse PDF
			const response = await axios.post(`${apiurl}/files`, formData);
			const { biomarkers, fileId } = response.data;

			// Step 2: Classify report type and determine correct endpoint
			const detectReportType = (biomarkersList) => {
				let urineCount = 0;
				let stoolCount = 0;
				let semenCount = 0;
				let papCount = 0;
				let swabCount = 0;
				let bloodCount = 0;

				biomarkersList.forEach(b => {
					const name = (b.testName || b.name || "").toLowerCase();
					if (name.includes("urine")) {
						urineCount++;
					} else if (name.includes("stool")) {
						stoolCount++;
					} else if (name.includes("semen") || name.includes("sperm") || name.includes("liquefaction") || name.includes("viscosity")) {
						semenCount++;
					} else if (name.includes("pap") || name.includes("cervical") || ["adequacy", "transformation zone", "asc-us", "asc-h", "lsil", "hsil", "hpv changes"].some(k => name.includes(k))) {
						papCount++;
					} else if (name.includes("swab") || name.includes("culture") || name.includes("gram stain") || name.includes("antibiotic")) {
						swabCount++;
					} else {
						bloodCount++;
					}
				});

				const counts = [
					{ type: "bloodreport", count: bloodCount },
					{ type: "urinereport", count: urineCount },
					{ type: "stoolreport", count: stoolCount },
					{ type: "semenanalysis", count: semenCount },
					{ type: "papsmear", count: papCount },
					{ type: "swabtest", count: swabCount }
				];

				let maxType = "bloodreport";
				let maxVal = -1;
				counts.forEach(c => {
					if (c.count > maxVal) {
						maxVal = c.count;
						maxType = c.type;
					}
				});

				if (maxVal === 0) return "bloodreport";
				return maxType;
			};

			const getReportEndpoint = (fn, biomarkersList) => {
				const lowercaseFn = fn.toLowerCase();
				if (lowercaseFn.includes("urine")) return "urinereport";
				if (lowercaseFn.includes("stool")) return "stoolreport";
				if (lowercaseFn.includes("semen") || lowercaseFn.includes("sperm")) return "semenanalysis";
				if (lowercaseFn.includes("pap")) return "papsmear";
				if (lowercaseFn.includes("swab")) return "swabtest";
				if (lowercaseFn.includes("blood") || lowercaseFn.includes("cbc")) return "bloodreport";

				return detectReportType(biomarkersList);
			};

			const endpoint = getReportEndpoint(file.name, biomarkers);

			// Step 3: Create report document linked to fileId
			const reportRes = await axios.post(`${apiurl}/${endpoint}/`, {
				reportDate: new Date().toISOString(),
				biomarkers: biomarkers,
				description: `Uploaded via chatbot on ${new Date().toLocaleDateString()}`,
				fileId: fileId
			});

			const newReport = reportRes.data.report;

			// Step 4: Refresh active report selector & select the new report
			await fetchUploadedReports();
			setSelectedReportId(newReport._id);

			// Map endpoint to readable type name
			const typeLabels = {
				bloodreport: "Blood Test",
				urinereport: "Urine Test",
				stoolreport: "Stool Test",
				semenanalysis: "Semen Analysis",
				papsmear: "Pap Smear",
				swabtest: "Swab Test"
			};
			const typeLabel = typeLabels[endpoint] || "Medical Report";

			setMessages((prevMessages) => [
				...prevMessages,
				{
					sender: "bot",
					text: `I have successfully uploaded and analyzed your medical report **${file.name}** (${typeLabel}). I've set it as the active context. How can I help you analyze it?`
				}
			]);
		} catch (error) {
			console.error("Chat PDF upload error:", error);
			setError("Failed to upload and parse the medical report.");
			setMessages((prevMessages) => [
				...prevMessages,
				{ sender: "bot", text: "Sorry, I encountered an error while trying to process your medical report. Please check if it is a valid text-based PDF." }
			]);
		}
	};

	const renderTooltipWithoutRange = ({ payload, ...rest }) => {
		const newPayload = payload ? payload.filter((x) => x.dataKey !== "range") : [];
		return <DefaultLegendContent payload={newPayload} {...rest} />;
	};

	const renderLegendWithoutRange = ({ payload, ...rest }) => {
		const newPayload = payload ? payload.filter((x) => x.dataKey !== "range") : [];
		return <DefaultLegendContent payload={newPayload} {...rest} />;
	};

	return (
		<div style={{ overflow: "hidden" }}>
			{/* Navbar */}
			<Navbar leftActions={
				<div className={styles.button_nav_bar}>
					<button className={styles.minimize_btn} onClick={toggleReportSummary}>
						{showReportSummary ? "Hide Sidebar" : "Show Sidebar"}
					</button>
					<button className={styles.new_chat_button} onClick={newChat} title="New Chat">
						<FiPlus />
					</button>
				</div>
			} />

			<div className={styles.page}>
				{showReportSummary && (
					<div className={styles.side_panel}>
						<div className={styles.chat_title}>Previous Chats</div>
						<div className={styles.chat_summary}>
							{conversations.slice().reverse().map((conversation, index) => (
								<div
									key={index}
									className={`${styles.summary} ${conversation.conversationID === conversationID ? styles.active_summary : ""}`}
									onClick={() => chatClicks(conversation.conversationID)}
								>
									<FiMessageSquare className={styles.chat_item_icon} />
									<p>{conversation.topic}</p>
									<button
										className={styles.delete_chat_btn}
										onClick={(e) => {
											e.stopPropagation();
											deleteChat(conversation.conversationID);
										}}
										title="Delete Chat"
									>
										<FiTrash2 />
									</button>
								</div>
							))}
						</div>
						{conversations.length > 0 && (
							<button
								className={styles.clear_history_btn}
								onClick={clearAllHistory}
								title="Clear All History"
							>
								<FiTrash2 /> Clear All History
							</button>
						)}
					</div>
				)}

				<div className={styles.chat}>
					<div className={styles.chat_container}>
						{/* Report Selector Dropdown */}
						<div className={styles.report_selector_container}>
							<label htmlFor="report-select" className={styles.report_select_label}>Active Report Context:</label>
							<select
								id="report-select"
								className={styles.report_select}
								value={selectedReportId}
								onChange={(e) => setSelectedReportId(e.target.value)}
							>
								<option value="">-- Select a medical report to chat about --</option>
								{uploadedReports.map((report) => (
									<option key={report._id} value={report._id}>
										{report.fileName} ({report.reportType} - {new Date(report.reportDate).toLocaleDateString()})
									</option>
								))}
							</select>
						</div>

						<div className={styles.chat_window}>
							{messages.length === 0 && (
								<div className={styles.chat_welcome_panel}>
									<FaHeartbeat className={styles.chat_welcome_icon} />
									<h3>Medical AI Consult</h3>
									<p>Ask health questions, discuss biomarker results, or request trends analysis for your uploaded lab reports.</p>
								</div>
							)}
							{messages.map((message, index) =>
								message.sender === "chart" ? (
									<div key={index} className={styles.chart_message_wrapper}>
										<ComposedChart
											width={500}
											height={280}
											data={message.data}
											margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
										>
											<CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
											<XAxis
												dataKey="date"
												tickFormatter={(date) => {
													if (date === "01/01/2000" || date === "12/31/3000") return "";
													const [month, , year] = date.split("/");
													return `${month}/${year.slice(2)}`;
												}}
												stroke="#6b7280"
												fontSize={11}
											/>
											<YAxis stroke="#6b7280" fontSize={11} />
											<Tooltip content={renderTooltipWithoutRange} />
											<Legend content={renderLegendWithoutRange} />
											<Area
												type="monotone"
												dataKey="range"
												fill="var(--color-success-bg)"
												stroke="none"
												connectNulls={true}
											/>
											<Line type="monotone" dataKey="value" stroke="var(--primary-brand)" strokeWidth={2} activeDot={{ r: 6 }} />
										</ComposedChart>
									</div>
								) : (
									<div key={index} className={styles[`${message.sender}_message`]}>
										<div className={styles.message_bubble}>
											{message.sender === "bot" ? (
												<BotResponse text={message.text} />
											) : (
												message.text
											)}
										</div>
									</div>
								)
							)}
						</div>
 
						{/* Quick Action Suggested Queries */}
						<div className={styles.options_container}>
							<button
								className={styles.option_btn}
								onClick={() => {
									setInput("View Results for ");
									if (inputRef.current) inputRef.current.focus();
								}}
							>
								View Results for ...
							</button>
							<button
								className={styles.option_btn}
								onClick={() => {
									navigate("/reports/results");
								}}
							>
								View All Results
							</button>
							<button
								className={styles.option_btn}
								onClick={() => {
									let targetId = selectedReportId;
									if (!targetId && uploadedReports.length > 0) {
										targetId = uploadedReports[0]._id;
										setSelectedReportId(targetId);
									}
									sendMessage("Discuss my latest report", targetId);
								}}
							>
								Discuss my Latest Report
							</button>
						</div>

						{/* Input Container */}
						<div className={styles.input_container}>
							<div className={styles.dropzone} onClick={clickInput} title="Upload report PDF">
								<FaCloudUploadAlt className={styles.upload_icon} />
								<input
									type="file"
									name="file"
									className={styles.dropzone_input}
									ref={fileInputRef}
									onChange={onFileChange}
									accept=".pdf"
								/>
							</div>
							<input
								type="text"
								className={styles.input}
								placeholder="Ask MedInsight AI a health question..."
								value={input}
								onChange={handleInputChange}
								onKeyPress={handleKeyPress}
								ref={inputRef}
							/>
							<button className={styles.send_btn} onClick={sendMessage}>
								Send
							</button>
						</div>
						{error && <div className={styles.error_banner}>{error}</div>}
					</div>
				</div>
			</div>
		</div>
	);
}

export default Chatbot;
