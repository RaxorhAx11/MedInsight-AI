import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
	FaUpload,
	FaMicroscope,
	FaExclamationTriangle,
	FaTrashAlt,
	FaCog,
	FaUser,
	FaChevronDown,
	FaChevronUp,
	FaCalendarAlt,
	FaHistory,
	FaRegFolderOpen
} from "react-icons/fa";
import styles from "./reportTimeline.module.css";
import apiurl from "../../config/api";

const ReportTimeline = ({ reportsCount = 0 }) => {
	const navigate = useNavigate();
	const [activities, setActivities] = useState([]);
	const [expandedItems, setExpandedItems] = useState({});
	const [isLoading, setIsLoading] = useState(true);
	const [isVisible, setIsVisible] = useState(false);
	const sectionRef = useRef(null);

	const fetchActivities = async () => {
		try {
			setIsLoading(true);
			const token = localStorage.getItem("token");
			if (!token) {
				setIsLoading(false);
				return;
			}

			const response = await axios.get(`${apiurl}/activities`, {
				headers: { Authorization: `Bearer ${token}` }
			});
			// Show top 5 on the dashboard timeline preview
			setActivities(response.data.slice(0, 5));
		} catch (err) {
			console.error("Error fetching activities for timeline:", err);
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		fetchActivities();
	}, [reportsCount]);

	useEffect(() => {
		const currentSection = sectionRef.current;
		
		// Fallback timeout to ensure timeline is visible even if IntersectionObserver doesn't fire
		const fallbackTimeout = setTimeout(() => {
			setIsVisible(true);
		}, 800);

		if (typeof window !== "undefined" && window.IntersectionObserver) {
			const observer = new IntersectionObserver(
				([entry]) => {
					if (entry.isIntersecting) {
						setIsVisible(true);
						if (currentSection) {
							observer.unobserve(currentSection);
						}
						clearTimeout(fallbackTimeout);
					}
				},
				{ threshold: 0.05 }
			);

			if (currentSection) {
				observer.observe(currentSection);
			}

			return () => {
				if (currentSection) {
					observer.unobserve(currentSection);
				}
				clearTimeout(fallbackTimeout);
			};
		} else {
			setIsVisible(true);
			clearTimeout(fallbackTimeout);
		}
	}, []);

	const toggleExpand = (id) => {
		setExpandedItems((prev) => ({
			...prev,
			[id]: !prev[id]
		}));
	};

	const getActivityIcon = (type) => {
		switch (type) {
			case "upload":
				return <FaUpload className={styles.icon_upload} />;
			case "analysis":
				return <FaMicroscope className={styles.icon_analysis} />;
			case "alert":
				return <FaExclamationTriangle className={styles.icon_alert} />;
			case "delete":
				return <FaTrashAlt className={styles.icon_delete} />;
			case "settings":
				return <FaCog className={styles.icon_settings} />;
			case "profile":
				return <FaUser className={styles.icon_profile} />;
			default:
				return <FaHistory className={styles.icon_default} />;
		}
	};

	const getStatusBadgeClass = (status) => {
		switch (status) {
			case "Completed":
				return styles.badge_completed;
			case "Warning":
				return styles.badge_warning;
			case "Processing":
				return styles.badge_processing;
			case "Failed":
				return styles.badge_failed;
			default:
				return styles.badge_completed;
		}
	};

	if (isLoading) {
		return (
			<div className={styles.timeline_loading}>
				<div className={styles.spinner}></div>
				<p>Loading activity timeline...</p>
			</div>
		);
	}

	return (
		<section 
			ref={sectionRef} 
			className={`${styles.timeline_section} ${isVisible ? styles.animate_visible : ""}`}
		>
			<div className={styles.timeline_header}>
				<div className={styles.header_title}>
					<FaHistory className={styles.title_icon} />
					<h3>Report History & Activities</h3>
				</div>
				<p className={styles.header_subtitle}>Chronological log of your health records, AI insights, and system activities.</p>
			</div>

			{activities.length === 0 ? (
				<div className={styles.empty_timeline}>
					<div className={styles.empty_icon_wrapper}>
						<FaRegFolderOpen className={styles.empty_icon} />
					</div>
					<h4>No report activity yet</h4>
					<p>Upload a biomarker report to start generating AI consult and health activity logs.</p>
					<button 
						className={styles.upload_first_btn}
						onClick={() => navigate("/reports/add")}
					>
						Upload First Report
					</button>
				</div>
			) : (
				<div className={styles.timeline_container}>
					{/* Connecting Line */}
					<div className={styles.timeline_line}></div>

					{activities.map((activity, index) => {
						const isExpanded = !!expandedItems[activity._id];
						const formattedTime = new Date(activity.createdAt).toLocaleTimeString([], {
							hour: "2-digit",
							minute: "2-digit"
						});
						const formattedDate = new Date(activity.createdAt).toLocaleDateString([], {
							month: "short",
							day: "numeric",
							year: "numeric"
						});

						return (
							<div 
								key={activity._id} 
								className={styles.timeline_item}
								style={{ "--stagger-index": index }}
							>
								{/* Icon Marker */}
								<div className={`${styles.timeline_marker} ${styles[`marker_${activity.activityType}`]}`}>
									{getActivityIcon(activity.activityType)}
								</div>

								{/* Card Content */}
								<div 
									className={`${styles.timeline_card} ${isExpanded ? styles.card_expanded : ""}`}
									onClick={() => toggleExpand(activity._id)}
								>
									<div className={styles.card_header}>
										<div className={styles.card_title_area}>
											<span className={styles.activity_time}>
												<FaCalendarAlt className={styles.time_icon} />
												{formattedDate} at {formattedTime}
											</span>
											<h4>{activity.title}</h4>
										</div>
										<span className={`${styles.status_badge} ${getStatusBadgeClass(activity.status)}`}>
											{activity.status}
										</span>
									</div>

									<p className={styles.card_short_desc}>
										{activity.description.length > 95 && !isExpanded
											? `${activity.description.substring(0, 95)}...`
											: activity.description}
									</p>

									{/* Expandable details area */}
									<div className={`${styles.card_details} ${isExpanded ? styles.details_visible : ""}`}>
										<div className={styles.details_divider}></div>
										<div className={styles.details_grid}>
											<div className={styles.details_info}>
												<strong>Activity Type:</strong> 
												<span className={styles.type_label}>{activity.activityType.toUpperCase()}</span>
											</div>
											<div className={styles.details_info}>
												<strong>Timestamp:</strong> {new Date(activity.createdAt).toString()}
											</div>
										</div>
										{activity.activityType === "upload" && (
											<button 
												className={styles.shortcut_btn}
												onClick={(e) => {
													e.stopPropagation();
													navigate("/reports");
												}}
											>
												View Reports Directory
											</button>
										)}
										{activity.activityType === "alert" && (
											<button 
												className={styles.shortcut_btn_alert}
												onClick={(e) => {
													e.stopPropagation();
													navigate("/reports/results");
												}}
											>
												Check Abnormal Biomarkers
											</button>
										)}
									</div>

									{/* Toggle Icon */}
									<div className={styles.card_toggle_indicator}>
										{isExpanded ? <FaChevronUp /> : <FaChevronDown />}
									</div>
								</div>
							</div>
						);
					})}

					{/* View Full History Button */}
					<div className={styles.timeline_footer}>
						<button 
							className={styles.view_all_btn}
							onClick={() => navigate("/activity")}
						>
							<span>View Full History</span>
							<FaHistory className={styles.btn_icon} />
						</button>
					</div>
				</div>
			)}
		</section>
	);
};

export default ReportTimeline;
