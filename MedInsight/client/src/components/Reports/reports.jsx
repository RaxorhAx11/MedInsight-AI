import React from "react";
import { useNavigate } from "react-router-dom";
import styles from "./reports.module.css";
import Navbar from "../Navbar";
import { 
	FaChevronLeft, 
	FaFileMedical, 
	FaChartLine, 
	FaPlus 
} from "react-icons/fa";

const Reports = () => {
    const navigate = useNavigate();

    const handleAddNew = () => {
        navigate("/reports/add");
    };



    const home = () => {
        navigate("/");
    };

    return (
		<div className={styles.main_wrapper}>
			{/* Navbar */}
			<Navbar />

			<div className={styles.reports_container}>
				<header className={styles.reports_header}>
					<div className={styles.header_left}>
						<button className={styles.back_btn} onClick={home} aria-label="Back to dashboard">
							<FaChevronLeft />
						</button>
						<div className={styles.header_text}>
							<h2>Reports & Biomarkers Hub</h2>
							<p>Manage your uploaded laboratory files and monitor extracted biometric results.</p>
						</div>
					</div>
					<button className={styles.primary_btn} onClick={handleAddNew}>
						<FaPlus /> <span>Add New Report</span>
					</button>
				</header>

				<div className={styles.buttons_container}>
					<div
						className={`${styles.button_card} ${styles.labreports_card}`}
						onClick={() => navigate("/reports/labreports")}
					>
						<div className={styles.card_content}>
							<div className={styles.card_icon_wrapper}>
								<FaFileMedical className={styles.card_icon} />
							</div>
							<div className={styles.card_text}>
								<h3>Lab Reports</h3>
								<p>View your uploaded medical test documents and detailed records.</p>
							</div>
						</div>
					</div>

					<div
						className={`${styles.button_card} ${styles.results_card}`}
						onClick={() => navigate("/reports/results")}
					>
						<div className={styles.card_content}>
							<div className={styles.card_icon_wrapper}>
								<FaChartLine className={styles.card_icon} />
							</div>
							<div className={styles.card_text}>
								<h3>Track Biomarkers</h3>
								<p>Analyze biomarkers health alerts, ranges, and chronological trends.</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
    );
};

export default Reports;

