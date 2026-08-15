import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
	FaFileMedical,
	FaHeartbeat,
	FaExclamationTriangle,
	FaUserCircle,
	FaUpload,
	FaCommentMedical,
	FaSpinner,
	FaDownload,
	FaChevronRight,
	FaCheckCircle,
	FaTrashAlt
} from "react-icons/fa";
import styles from "./styles.module.css";
import Navbar from "../Navbar";
import ReportTimeline from "./ReportTimeline";
import ScrollReveal from "../ScrollReveal";
import apiurl from "../../config/api";

const AnimatedCounter = ({ value, duration = 600, suffix = "" }) => {
	const [count, setCount] = useState(0);
	useEffect(() => {
		const numValue = parseFloat(value);
		if (isNaN(numValue)) {
			setCount(value);
			return;
		}
		let startTime = null;
		let animationFrameId;
		const animate = (timestamp) => {
			if (!startTime) startTime = timestamp;
			const progress = Math.min((timestamp - startTime) / duration, 1);
			const current = Math.floor(progress * numValue);
			setCount(current);
			if (progress < 1) {
				animationFrameId = window.requestAnimationFrame(animate);
			} else {
				setCount(numValue);
			}
		};
		animationFrameId = window.requestAnimationFrame(animate);
		return () => {
			if (animationFrameId) {
				window.cancelAnimationFrame(animationFrameId);
			}
		};
	}, [value, duration]);
	return <span>{count}{suffix}</span>;
};

function Main() {
	const navigate = useNavigate();
	const [profileData, setProfileData] = useState({ firstName: "", lastName: "", progress: 0 });
	const [reports, setReports] = useState([]);
	const [biomarkers, setBiomarkers] = useState([]);
	const [settings, setSettings] = useState({ aiInsights: true, autoAnomaly: true });
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState("");

	const fetchDashboardData = async () => {
		try {
			setIsLoading(true);
			setError("");

			const token = localStorage.getItem("token");
			const config = { headers: { Authorization: `Bearer ${token}` } };

			const endpoints = [
				{ name: "bloodreport", label: "Blood Report" },
				{ name: "urinereport", label: "Urine Report" },
				{ name: "stoolreport", label: "Stool Report" },
				{ name: "semenanalysis", label: "Semen Analysis" },
				{ name: "papsmear", label: "Pap Smear" },
				{ name: "swabtest", label: "Swab Test" }
			];

			const biomarkerPromises = endpoints.map(ep =>
				axios.get(`${apiurl}/${ep.name}/biomarkers`, config)
					.then(res => (res.data || []).map(b => ({ ...b, reportType: ep.name })))
					.catch(err => {
						if (err.response && err.response.status === 404) {
							return [];
						}
						console.error(`Error fetching biomarkers for ${ep.name}:`, err);
						return [];
					})
			);

			// Fetch user profile, uploaded files, and biomarker parameters in parallel
			const [profileRes, filesRes, ...biomarkerResults] = await Promise.all([
				axios.get(`${apiurl}/users/profile`, config),
				axios.get(`${apiurl}/files`, config),
				...biomarkerPromises
			]);

			const profile = profileRes.data;

			// Calculate profile completion rate based on filled optional health metrics
			const totalFields = 4;
			const completedFields = Object.keys(profile).filter(
				(key) => ["age", "height", "weight", "sex"].includes(key) && profile[key]
			).length;
			profile.progress = Math.round((completedFields / totalFields) * 100);

			setProfileData(profile);
			if (profile.settings) {
				setSettings(profile.settings);
			}
			setReports(filesRes.data || []);
			setBiomarkers(biomarkerResults.flat());
		} catch (err) {
			console.error("Error fetching dashboard data:", err);
			setError("Failed to retrieve dashboard records. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		fetchDashboardData();
	}, []);

	const deleteReport = async (reportId) => {
		if (!window.confirm("Are you sure you want to delete this lab report? This will delete the report and remove its biometric results from your tracked history.")) return;

		try {
			const token = localStorage.getItem("token");
			await axios.delete(`${apiurl}/files/${reportId}`, {
				headers: { Authorization: `Bearer ${token}` }
			});
			// Reload all dashboard statistics and biomarkers
			await fetchDashboardData();
		} catch (err) {
			console.error("Error deleting report:", err);
			setError("Failed to delete report.");
		}
	};



	// Helper to extract active out-of-range alerts (High/Low parameters)
	const healthAlerts = settings.autoAnomaly ? biomarkers.filter(b => b.status === "High" || b.status === "Low") : [];

	if (isLoading) {
		return (
			<div className={styles.loading_container}>
				<FaSpinner className={styles.loading_spinner} />
				<p>Loading your medical dashboard...</p>
			</div>
		);
	}

	return (
		<div className={styles.main_wrapper}>
			{/* Navbar */}
			<Navbar />

			<div className={styles.dashboard_container}>
				{/* Personalized Welcome Header */}
				<ScrollReveal animation="fade-slide-up" duration={550}>
					<header className={styles.dashboard_header}>
						<div className={styles.welcome_text}>
							<h2>Welcome back, {profileData.firstName || "User"}!</h2>
							<p>Here is an overview of your health parameter analysis and reports history.</p>
						</div>
						<div className={styles.header_actions}>
							<button className={`${styles.primary_btn} btn-press-premium`} onClick={() => navigate("/reports/add")}>
								<FaUpload /> <span>Upload Report</span>
							</button>
							<button className={`${styles.secondary_btn} btn-press-premium`} onClick={() => navigate("/chat")}>
								<FaCommentMedical /> <span>Chat with AI</span>
							</button>
						</div>
					</header>
				</ScrollReveal>

				{error && (
					<div className={styles.error_banner}>
						<FaExclamationTriangle />
						<span>{error}</span>
					</div>
				)}

				{/* 4 Quick Summary Metrics Grid */}
				<section className={styles.stats_grid}>
					<ScrollReveal animation="fade-slide-up" delay={50} duration={500}>
						<div className={styles.stats_card}>
							<div className={styles.stats_icon_wrapper}>
								<FaFileMedical className={styles.stats_icon} />
							</div>
							<div className={styles.stats_info}>
								<span className={styles.stats_number}>
									<AnimatedCounter value={reports.length} />
								</span>
								<span className={styles.stats_label}>Uploaded Reports</span>
							</div>
						</div>
					</ScrollReveal>

					<ScrollReveal animation="fade-slide-up" delay={130} duration={500}>
						<div className={styles.stats_card}>
							<div className={styles.stats_icon_wrapper}>
								<FaHeartbeat className={styles.stats_icon} />
							</div>
							<div className={styles.stats_info}>
								<span className={styles.stats_number}>
									<AnimatedCounter value={biomarkers.length} />
								</span>
								<span className={styles.stats_label}>Biomarkers Tracked</span>
							</div>
						</div>
					</ScrollReveal>

					<ScrollReveal animation="fade-slide-up" delay={210} duration={500}>
						<div className={`${styles.stats_card} ${healthAlerts.length > 0 ? styles.alert_state : ""}`}>
							<div className={styles.stats_icon_wrapper}>
								<FaExclamationTriangle className={styles.stats_icon} />
							</div>
							<div className={styles.stats_info}>
								<span className={styles.stats_number}>
									<AnimatedCounter value={healthAlerts.length} />
								</span>
								<span className={styles.stats_label}>Health Alerts</span>
							</div>
						</div>
					</ScrollReveal>

					<ScrollReveal animation="fade-slide-up" delay={290} duration={500}>
						<div className={styles.stats_card} onClick={() => navigate("/profile")} style={{ cursor: "pointer" }}>
							<div className={styles.stats_icon_wrapper}>
								<FaUserCircle className={styles.stats_icon} />
							</div>
							<div className={styles.stats_info}>
								<span className={styles.stats_number}>
									<AnimatedCounter value={profileData.progress} suffix="%" />
								</span>
								<span className={styles.stats_label}>Profile Completeness</span>
							</div>
						</div>
					</ScrollReveal>
				</section>

				{/* AI Personalized Recommendations Section */}
				<ScrollReveal animation="scale-up" delay={250} duration={550}>
					<section className={styles.ai_recommendations_section}>
						<h3>AI Health Recommendations</h3>
						{settings.aiInsights ? (
							<div className={styles.ai_insights_container}>
								{biomarkers.filter(b => b.status === "High" || b.status === "Low").length === 0 ? (
									<p>✨ All tracked biomarkers are currently within their standard normal ranges. Continue maintaining a balanced lifestyle with regular physical activity, proper hydration, and nutritious meals to support your long-term wellness!</p>
								) : (
									<ul className={styles.ai_insights_list}>
										{biomarkers.filter(b => b.status === "High" || b.status === "Low").slice(0, 3).map((b, idx) => (
											<li key={idx} className={styles.ai_insight_item}>
												<strong>{b.name} ({b.result} {b.unit} - {b.status}):</strong>
												{b.status === "High" 
													? ` Your level is elevated. Consider reducing sodium/processed sugar intake, drinking plenty of water, and checking in with your healthcare provider to examine possible physiological causes.`
													: ` Your level is below the reference range. Consider discussing iron/vitamin supplementation, incorporating mineral-rich leafy greens and clean proteins, and scheduling a follow-up test.`}
											</li>
										))}
									</ul>
								)}
							</div>
						) : (
							<div className={styles.ai_insights_disabled}>
								<p>AI health recommendations are currently disabled. Turn them on in the Settings menu (top right) to receive automated wellness tips customized to your test results.</p>
							</div>
						)}
					</section>
				</ScrollReveal>

				{/* Two-Column Section */}
				<section className={styles.main_content_split}>
					{/* Left Column: Recent Activity Feed */}
					<ScrollReveal className={styles.activity_feed} animation="fade-slide-up" delay={300} duration={600}>
						<h3>Recent Lab Reports</h3>
						{reports.length === 0 ? (
							<div className={styles.empty_state_card}>
								<FaFileMedical className={styles.empty_icon} />
								<h4>No medical reports uploaded yet</h4>
								<p>Upload a PDF biomarker report to begin tracking parameters with AI insights.</p>
								<button className={`${styles.action_btn} btn-press-premium`} onClick={() => navigate("/reports/add")}>
									Upload First Report
								</button>
							</div>
						) : (
							<div className={styles.feed_list}>
								{reports.slice(0, 3).map((report, idx) => (
									<ScrollReveal
										key={report._id}
										className={styles.feed_item}
										animation="fade-slide-up"
										delay={idx * 60}
										duration={400}
									>
										<div className={styles.feed_item_left}>
											<FaFileMedical className={styles.report_item_icon} />
											<div className={styles.report_meta}>
												<h4>{report.fileName.length > 32 ? `${report.fileName.substring(0, 32)}...` : report.fileName}</h4>
												<span className={styles.report_date}>
													Uploaded on {new Date(report.testDate).toLocaleDateString()}
												</span>
												{report.description && <p className={styles.report_desc}>{report.description}</p>}
											</div>
										</div>
										<div className={styles.feed_item_actions}>
											<a href={report.url} target="_blank" rel="noopener noreferrer" className={`${styles.download_btn} btn-press-premium`} title="Download PDF report">
												<FaDownload />
											</a>
											<button
												className={`${styles.delete_report_btn} btn-press-premium`}
												onClick={() => deleteReport(report._id)}
												title="Delete Report"
											>
												<FaTrashAlt />
											</button>
										</div>
									</ScrollReveal>
								))}
								{reports.length > 3 && (
									<button className={styles.view_all_link} onClick={() => navigate("/reports")}>
										<span>View all reports</span>
										<FaChevronRight />
									</button>
								)}
							</div>
						)}
					</ScrollReveal>

					{/* Right Column: Health Alerts & Biomarker Feed */}
					<ScrollReveal className={styles.alerts_feed} animation="fade-slide-up" delay={350} duration={600}>
						<h3>Active Biomarker Alerts</h3>
						{reports.length === 0 ? (
							<div className={styles.empty_state_card}>
								<FaHeartbeat className={styles.empty_icon} />
								<h4>No biomarkers tracked</h4>
								<p>Upload medical biomarker reports to populate health tracker feeds.</p>
							</div>
						) : healthAlerts.length === 0 ? (
							<div className={styles.healthy_state_card}>
								<FaCheckCircle className={styles.healthy_icon} />
								<h4>All Systems Normal</h4>
								<p>All of your analyzed biomarkers currently fall within standard reference ranges.</p>
								<button className={`${styles.action_btn} btn-press-premium`} onClick={() => navigate("/reports")}>
									View Biomarkers
								</button>
							</div>
						) : (
							<div className={styles.alerts_list}>
								{healthAlerts.slice(0, 4).map((alert, idx) => (
									<ScrollReveal
										key={alert.name}
										className={styles.alert_item}
										animation="fade-slide-up"
										delay={idx * 60}
										duration={400}
										onClick={() => navigate(`/reports/biomarker/${alert.name}?type=${alert.reportType}`)}
									>
										<div className={styles.alert_badge_wrapper}>
											<span className={`${styles.alert_badge} ${alert.status === "High" ? styles.badge_high : styles.badge_low}`}>
												{alert.status}
											</span>
										</div>
										<div className={styles.alert_details}>
											<h4>{alert.name}</h4>
											<p className={styles.alert_values}>
												Current: <strong>{alert.result} {alert.unit}</strong> | Reference: {alert.referenceRange.min} - {alert.referenceRange.max} {alert.unit}
											</p>
										</div>
										<FaChevronRight className={styles.alert_arrow} />
									</ScrollReveal>
								))}
								{biomarkers.length > 0 && (
									<button className={styles.view_all_link} onClick={() => navigate("/reports/results")}>
										<span>View all biomarkers</span>
										<FaChevronRight />
									</button>
								)}
							</div>
						)}
					</ScrollReveal>
				</section>

				{/* Report History Timeline */}
				<ScrollReveal animation="fade-slide-up" delay={400} duration={600}>
					<ReportTimeline reportsCount={reports.length} />
				</ScrollReveal>
			</div>
		</div>
	);
}

export default Main;
