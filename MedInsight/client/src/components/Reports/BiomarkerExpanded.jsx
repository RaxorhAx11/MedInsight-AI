import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import styles from "./biomarkerexpanded.module.css";
import Navbar from "../Navbar";
import { useTheme } from "../../context/ThemeContext";
import {
	ResponsiveContainer,
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
import { 
	FaChevronLeft, 
	FaCommentMedical, 
	FaInfoCircle,
	FaExclamationTriangle
} from "react-icons/fa";
import apiurl from "../../config/api";

const BiomarkerExpanded = () => {
	const navigate = useNavigate();
	const { name } = useParams();
	const [biomarkerData, setBiomarkerData] = useState(null);
	const [error, setError] = useState(null);
	const [loading, setLoading] = useState(true);
	const { settings } = useTheme();

	const queryParams = new URLSearchParams(window.location.search);
	const reportType = queryParams.get("type") || "bloodreport";

	const getDisplayName = (name, reportType) => {
		let displayName = name;
		if (name.startsWith("Urine ")) {
			displayName = name.replace("Urine ", "");
		} else if (name.startsWith("Stool ")) {
			displayName = name.replace("Stool ", "");
		} else if (name.startsWith("Semen ")) {
			displayName = name.replace("Semen ", "");
		} else if (name.startsWith("Swab ")) {
			displayName = name.replace("Swab ", "");
		} else if (name.startsWith("Cervical ")) {
			displayName = name.replace("Cervical ", "");
		} else if (name.startsWith("Pap Smear ")) {
			displayName = name.replace("Pap Smear ", "");
		}
		
		if (displayName === "WBC (Pus Cells)" && reportType === "stoolreport") {
			return "Pus Cells";
		}
		if (displayName === "Sperm Concentration") {
			return "Sperm Concentration";
		}
		if (displayName === "Sperm Motility") {
			return "Motility";
		}
		if (displayName === "Sperm Morphology") {
			return "Morphology";
		}
		if (displayName === "Sperm Vitality") {
			return "Vitality";
		}
		return displayName;
	};

	const capitalizeWords = (str) => {
		return str
			.split(' ')
			.map(word => {
				if (word.startsWith("(") && word.endsWith(")")) return word;
				if (word.toLowerCase() === "ph") return "pH";
				if (word.toLowerCase() === "wbc") return "WBC";
				if (word.toLowerCase() === "rbc") return "RBC";
				if (word.toLowerCase() === "hpv") return "HPV";
				if (word.toLowerCase() === "asc-us") return "ASC-US";
				if (word.toLowerCase() === "asc-h") return "ASC-H";
				if (word.toLowerCase() === "lsil") return "LSIL";
				if (word.toLowerCase() === "hsil") return "HSIL";
				return word.charAt(0).toUpperCase() + word.slice(1);
			})
			.join(' ');
	};



	// Fetch biomarker data
	useEffect(() => {
		const fetchBiomarkerData = async () => {
			try {
				setLoading(true);
				const token = localStorage.getItem("token");
				const response = await axios.get(
					`${apiurl}/${reportType}/history/${name}`,
					{
						headers: { Authorization: `Bearer ${token}` },
					}
				);
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

				if (history.length > 0) {
					setBiomarkerData({
						description: history[0].description,
						unit: history[0].unit,
						history,
					});
					setError(null);
				} else {
					setError("No historical data available for this biomarker.");
				}
			} catch (err) {
				console.error("Error fetching biomarker data:", err);
				setError("Failed to load biomarker data. Please try again later.");
			} finally {
				setLoading(false);
			}
		};

		fetchBiomarkerData();
	}, [name, reportType]);

	if (loading) {
		return (
			<div className={styles.main_wrapper}>
				<div className={styles.loading_state}>
					<FaSpinner className={styles.spinner} />
					<p>Loading biomarker details...</p>
				</div>
			</div>
		);
	}

	if (error || !biomarkerData) {
		return (
			<div className={styles.main_wrapper}>
				<div className={styles.container}>
					<div className={styles.error_banner}>
						<FaExclamationTriangle />
						<span>{error || "An unexpected error occurred."}</span>
					</div>
					<button className={styles.backButton} onClick={() => navigate(-1)}>
						&larr; Back to Overview
					</button>
				</div>
			</div>
		);
	}

	const { description, unit, history } = biomarkerData;

	const latestResult = history[history.length - 1];

	const isNumeric = !isNaN(parseFloat(latestResult.value)) && 
		!isNaN(parseFloat(latestResult.range[0])) && 
		!isNaN(parseFloat(latestResult.range[1]));

	const numericHistory = history.map(h => ({
		...h,
		value: isNumeric ? parseFloat(h.value) : h.value,
		range: [
			isNumeric ? parseFloat(h.range[0]) : 0,
			isNumeric ? parseFloat(h.range[1]) : 0
		]
	}));

	// Calculate dynamic Y-axis range if numeric
	const rawMin = isNumeric ? Math.min(
		...numericHistory.map((data) => data.range[0]),
		...numericHistory.map((data) => data.value)
	) : 0;
	const rawMax = isNumeric ? Math.max(
		...numericHistory.map((data) => data.range[1]),
		...numericHistory.map((data) => data.value)
	) : 0;
	const rangeDelta = isNumeric ? (rawMax - rawMin) : 0;
	const yAxisMin = isNumeric ? Math.max(0, Math.round((rawMin - rangeDelta * 0.5) * 10) / 10) : 0;
	const yAxisMax = isNumeric ? Math.round((rawMax + rangeDelta * 0.5) * 10) / 10 : 100;

	const checkStringMatch = (val, ref) => {
		if (!val || !ref) return false;
		const v = val.toString().toLowerCase().trim();
		const r = ref.toString().toLowerCase().trim();
		return v === r || r.includes(v) || v.includes(r);
	};

	const renderTooltipWithoutRange = ({ payload, ...rest }) => {
		const newPayload = payload ? payload.filter((x) => x.dataKey !== "range") : [];
		return <DefaultLegendContent payload={newPayload} {...rest} />;
	};

	const renderLegendWithoutRange = ({ payload, ...rest }) => {
		const newPayload = payload ? payload.filter((x) => x.dataKey !== "range") : [];
		return <DefaultLegendContent payload={newPayload} {...rest} />;
	};
	
	const isLatestNormal = isNumeric
		? (latestResult.value >= latestResult.range[0] && latestResult.value <= latestResult.range[1])
		: (checkStringMatch(latestResult.value, latestResult.range[0]) || checkStringMatch(latestResult.value, "normal") || checkStringMatch(latestResult.value, "negative") || checkStringMatch(latestResult.value, "no growth") || checkStringMatch(latestResult.value, "balanced") || checkStringMatch(latestResult.value, "nilm"));

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

	return (
		<div className={styles.main_wrapper}>
			{/* Navigation */}
			<Navbar />

			{/* Content */}
			<div className={styles.container}>
				<header className={styles.header}>
					<div className={styles.header_left}>
						<button className={styles.back_btn} onClick={() => navigate(-1)} aria-label="Back to results list">
							<FaChevronLeft />
						</button>
						<div className={styles.header_text}>
							<span className={styles.category_label}>Biomarker History</span>
							<h2>{capitalizeWords(getDisplayName(name, reportType))}</h2>
						</div>
					</div>
				</header>

				{/* Summary Info Cards */}
				{(() => {
					const autoAnomalyEnabled = settings.autoAnomaly !== false;
					const aiInsightsEnabled = settings.aiInsights !== false;
					return (
						<div className={styles.summary_grid}>
							<div className={styles.summary_info_card}>
								<div className={styles.info_header}>
									<FaInfoCircle className={styles.info_icon} />
									<span>About Biomarker</span>
								</div>
								<p className={styles.description}>{description}</p>
								
								<div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
									<strong>AI Clinical Insight:</strong>
									{aiInsightsEnabled ? (
										<p style={{ margin: '6px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
											{latestResult.value === "Not mentioned in report" 
												? "No measurements found. Upload a report that includes this biomarker to receive custom recommendations."
												: !isLatestNormal 
													? `Alert: Your level is outside of standard limits. Incorporate supportive dietary adjustments, ensure steady daily hydration, and consult your general practitioner for a clinical evaluation.`
													: `Excellent: Your level is optimal and falls within standard guidelines. Keep maintaining your active habits and healthy nutritional intake.`}
										</p>
									) : (
										<p style={{ margin: '6px 0 0 0', fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
											AI Personalized Recommendations are disabled in settings. Enable them to view clinical guidelines.
										</p>
									)}
								</div>
							</div>

							<div className={styles.summary_status_card}>
								<div className={styles.status_row}>
									<span className={styles.status_label}>Latest Measurement</span>
									<strong className={styles.status_value}>{latestResult.value} {unit}</strong>
								</div>
								<div className={styles.status_row}>
									<span className={styles.status_label}>Reference Range</span>
									<strong className={styles.status_value}>{latestResult.range[0]} - {latestResult.range[1]} {unit}</strong>
								</div>
								<div className={styles.status_row}>
									<span className={styles.status_label}>Status</span>
									<span className={`${styles.status_badge} ${
										latestResult.value === "Not mentioned in report" 
											? styles.badge_not_mentioned 
											: !autoAnomalyEnabled 
												? styles.badge_not_mentioned
												: isLatestNormal ? styles.badge_normal : styles.badge_abnormal
									}`}>
										{latestResult.value === "Not mentioned in report" 
											? "Not Mentioned" 
											: !autoAnomalyEnabled 
												? "Checked" 
												: (isLatestNormal ? "Normal" : "Out of Range")}
									</span>
								</div>
							</div>
						</div>
					);
				})()}

				{/* Chart Card */}
				<div className={styles.chart_card}>
					<h3>Value Trajectory</h3>
					<div className={styles.chartContainer}>
						{isNumeric && history.length > 0 ? (
							<ResponsiveContainer width="100%" height={320}>
								<ComposedChart
									data={historyWithPadding}
									margin={{
										top: 10,
										right: 10,
										left: -10,
										bottom: 10,
									}}
								>
									<CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
									<XAxis
										dataKey="date"
										padding={{ left: 20, right: 20 }}
										stroke="#94a3b8"
										tick={{ fontSize: 11, fontWeight: 500 }}
										tickFormatter={(date) => {
											if (date === "01/01/2000" || date === "12/31/3000") return "";
											const parts = date.split("/");
											if (parts.length < 3) return date;
											return `${parts[0]}/${parts[2].slice(2)}`;
										}}
									/>
									<YAxis 
										domain={[yAxisMin, yAxisMax]} 
										stroke="#94a3b8" 
										tick={{ fontSize: 11, fontWeight: 500 }}
									/>
									<Tooltip content={renderTooltipWithoutRange} />
									<Legend content={renderLegendWithoutRange} />
									<Area
										type="monotone"
										dataKey="range"
										fill="var(--color-success-bg)"
										stroke="none"
										name="Reference Range"
									/>
									<Line
										type="monotone"
										dataKey="value"
										stroke="var(--primary-brand)"
										strokeWidth={3}
										dot={{ r: 5, strokeWidth: 2, fill: "#ffffff" }}
										activeDot={{ r: 7 }}
										name="Your Value"
									/>
								</ComposedChart>
							</ResponsiveContainer>
						) : history.length > 0 ? (
							<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '40px', color: '#6b7280', textAlign: 'center' }}>
								<p>Visual trendline is only available for numeric biomarker values. Please review the entries below.</p>
							</div>
						) : (
							<p className={styles.no_data_text}>No historical data available for this biomarker.</p>
						)}
					</div>
				</div>

				{/* Past Results list */}
				<div className={styles.historySection}>
					<h3>Chronological History</h3>
					<div className={styles.historyList}>
						{history
							.slice()
							.sort((a, b) => new Date(b.date) - new Date(a.date))
							.map((record, index) => {
								const lowerBound = record.range[0];
								const upperBound = record.range[1];
								const isRecordNumeric = !isNaN(parseFloat(record.value)) && !isNaN(parseFloat(lowerBound)) && !isNaN(parseFloat(upperBound));
								
								const isGood = isRecordNumeric
									? (record.value >= lowerBound && record.value <= upperBound)
									: (checkStringMatch(record.value, lowerBound) || checkStringMatch(record.value, "normal") || checkStringMatch(record.value, "negative") || checkStringMatch(record.value, "no growth") || checkStringMatch(record.value, "balanced") || checkStringMatch(record.value, "nilm") || checkStringMatch(record.value, "satisfactory"));
								
								const marginVal = isRecordNumeric ? (upperBound - lowerBound) * 0.20 : 0;
								
								const isModerate = isRecordNumeric &&
									((record.value >= lowerBound - marginVal && record.value < lowerBound) ||
									(record.value > upperBound && record.value <= upperBound + marginVal));
								
								const isBad = !isGood && !isModerate;

								let statusLabel = "Normal";
								let cardClass = styles.card_good;

								const autoAnomalyEnabled = settings.autoAnomaly !== false;

								if (record.value === "Not mentioned in report") {
									statusLabel = "Not Mentioned";
									cardClass = styles.card_not_mentioned;
								} else if (!autoAnomalyEnabled) {
									statusLabel = "Checked";
									cardClass = styles.card_not_mentioned;
								} else if (isModerate) {
									statusLabel = "Borderline";
									cardClass = styles.card_moderate;
								} else if (isBad) {
									statusLabel = "Out of Range";
									cardClass = styles.card_bad;
								}

								return (
									<div key={index} className={`${styles.history_item} ${cardClass}`}>
										<div className={styles.history_item_left}>
											<span className={styles.record_date}>
												{new Date(record.date).toLocaleDateString("en-US", {
													month: "long",
													day: "numeric",
													year: "numeric",
												})}
											</span>
											<span className={styles.record_status_label}>{statusLabel}</span>
										</div>
										<div className={styles.history_item_right}>
											<span className={styles.record_value}>
												<strong>{record.value}</strong> {record.value === "Not mentioned in report" ? "" : unit}
											</span>
											<span className={styles.record_range}>
												Ref: {lowerBound === "None" && upperBound === "None" ? "Negative/None" : `${lowerBound} - ${upperBound} ${unit || ""}`}
											</span>
										</div>
									</div>
								);
							})}
					</div>
				</div>

				{/* Footer Button Actions */}
				<div className={styles.action_footer}>
					<button
						className={styles.chatbot_btn}
						onClick={() => navigate("/chat")}
					>
						<FaCommentMedical />
						<span>Ask AI about {name}</span>
					</button>
				</div>
			</div>
		</div>
	);
};

// Simple inline loading spinner fallback (since FaSpinner needs to spin)
const FaSpinner = ({ className }) => (
	<svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" width="24" height="24">
		<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{opacity: 0.15}}></circle>
		<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" style={{opacity: 0.85}}></path>
	</svg>
);

export default BiomarkerExpanded;

