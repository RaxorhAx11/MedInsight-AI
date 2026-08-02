import React, { useEffect, useState } from "react";
import axios from "axios";
import styles from "./labreports.module.css";
import { 
	FaChevronLeft, 
	FaFileMedical, 
	FaCalendarAlt,
	FaDownload,
	FaPlus,
	FaTrashAlt
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import Navbar from "../Navbar";
import ScrollReveal from "../ScrollReveal";
import apiurl from "../../config/api";

const LabReports = () => {
    const [reports, setReports] = useState([]);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();



    const navReports = () => {
        navigate("/reports");
    };

    // Fetch reports with pre-signed URLs from the backend
    useEffect(() => {
        const fetchReports = async () => {
            try {
                setIsLoading(true);
                const response = await axios.get(`${apiurl}/files`);
                setReports(response.data || []);
            } catch (err) {
                console.error("Error fetching reports:", err);
                setError("Failed to fetch reports. Please try again later.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchReports();
    }, []);

    const deleteReport = async (reportId) => {
        if (!window.confirm("Are you sure you want to delete this lab report? This will delete the report and remove its biometric results from your tracked history.")) return;

        try {
            await axios.delete(`${apiurl}/files/${reportId}`);
            setReports(prev => prev.filter(r => r._id !== reportId));
        } catch (err) {
            console.error("Error deleting report:", err);
            setError("Failed to delete report.");
        }
    };

	return (
		<div className={styles.main_wrapper}>
			{/* Navbar */}
			<Navbar />

			<div className={styles.container}>
				{/* Header */}
				<ScrollReveal animation="fade-slide-up" duration={500}>
					<header className={styles.header}>
						<div className={styles.header_left}>
							<button className={`${styles.back_btn} btn-press-premium`} onClick={navReports} aria-label="Back to reports hub">
								<FaChevronLeft />
							</button>
							<div className={styles.header_text}>
								<h2>Your Lab Reports</h2>
								<p>Review and download your laboratory test documents analyzed by MedInsight AI.</p>
							</div>
						</div>
						<button className={`${styles.primary_btn} btn-press-premium`} onClick={() => navigate("/reports/add")}>
							<FaPlus /> <span>Upload Report</span>
						</button>
					</header>
				</ScrollReveal>

				{error && (
					<div className={styles.error_banner}>
						<span>{error}</span>
					</div>
				)}

				{isLoading ? (
					<div className={styles.loading_state}>
						<p>Loading reports...</p>
					</div>
				) : reports.length === 0 ? (
					<div className={styles.empty_state_card}>
						<FaFileMedical className={styles.empty_icon} />
						<h4>No Reports Uploaded</h4>
						<p>Upload a lab report PDF to automatically extract and track your biomarkers.</p>
						<button className={`${styles.action_btn} btn-press-premium`} onClick={() => navigate("/reports/add")}>
							Upload First Report
						</button>
					</div>
				) : (
					<div className={styles.reports_grid}>
						{reports.map((report, idx) => (
							<ScrollReveal 
								key={report._id} 
								className={styles.report_card}
								animation="fade-slide-up"
								delay={idx * 60}
								duration={450}
							>
								<div className={styles.card_main}>
									<div className={styles.icon_wrapper}>
										<FaFileMedical className={styles.report_icon} />
									</div>
									<div className={styles.card_info}>
										<h3 className={styles.report_title}>
											{report.fileName.length > 40 ? `${report.fileName.substring(0, 40)}...` : report.fileName}
										</h3>
										
										{report.description && (
											<p className={styles.description}>{report.description}</p>
										)}

										<div className={styles.date_row}>
											<div className={styles.date_item}>
												<FaCalendarAlt className={styles.date_icon} />
												<span>Uploaded: </span>
												<strong>
													{new Date(report.uploadDate).toLocaleDateString(undefined, {
														dateStyle: "medium",
													})}
												</strong>
											</div>
											<div className={styles.date_item}>
												<FaCalendarAlt className={styles.date_icon} />
												<span>Test Date: </span>
												<strong>
													{report.testDate
														? new Date(report.testDate).toLocaleDateString(undefined, {
															dateStyle: "medium",
														  })
														: "N/A"}
												</strong>
											</div>
										</div>
									</div>
								</div>

								<div className={styles.card_actions}>
									<a
										href={report.url}
										target="_blank"
										rel="noopener noreferrer"
										className={`${styles.download_btn} btn-press-premium`}
										title="Download Report PDF"
									>
										<FaDownload />
										<span>PDF</span>
									</a>
									<button
										className={`${styles.delete_btn} btn-press-premium`}
										onClick={() => deleteReport(report._id)}
										title="Delete Report"
									>
										<FaTrashAlt />
										<span>Delete</span>
									</button>
								</div>
							</ScrollReveal>
						))}
					</div>
				)}
			</div>
		</div>
	);
};

export default LabReports;

