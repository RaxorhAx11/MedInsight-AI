import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { useTheme } from "../../context/ThemeContext";
import {
	FaHeartbeat,
	FaBell,
	FaCog,
	FaSignOutAlt,
	FaUser,
	FaTimes,
	FaCheck,
	FaInfoCircle,
	FaExclamationTriangle,
	FaMoon,
	FaSun,
	FaThLarge
} from "react-icons/fa";
import styles from "./styles.module.css";
import apiurl from "../../config/api";

const formatTime = (dateStr) => {
	const date = new Date(dateStr);
	const seconds = Math.floor((new Date() - date) / 1000);
	if (seconds < 60) return "Just now";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	return date.toLocaleDateString();
};

function Navbar({ leftActions }) {
	const navigate = useNavigate();
	const location = useLocation();
	const [profileData, setProfileData] = useState(null);
	const [openDropdown, setOpenDropdown] = useState(null);
	const [animatingOut, setAnimatingOut] = useState(null);
	const openDropdownRef = useRef(openDropdown);
	const closeTimerRef = useRef(null);

	useEffect(() => {
		openDropdownRef.current = openDropdown;
	}, [openDropdown]);

	// Cleanup close timers on unmount
	useEffect(() => {
		return () => {
			if (closeTimerRef.current) {
				clearTimeout(closeTimerRef.current);
			}
		};
	}, []);

	// Toast state
	const [toast, setToast] = useState("");

	// Notifications State loaded from backend
	const [notifications, setNotifications] = useState([]);

	// Settings and theme managed globally
	const { settings, updateSettings, handleThemeToggle } = useTheme();

	const [saveSuccess, setSaveSuccess] = useState(false);

	const profileRef = useRef(null);
	const notificationsRef = useRef(null);
	const settingsRef = useRef(null);

	const showToast = (msg) => {
		setToast(msg);
		setTimeout(() => {
			setToast("");
		}, 3000);
	};

	const fetchNotifications = async () => {
		try {
			const token = localStorage.getItem("token");
			if (!token) return;
			const res = await axios.get(`${apiurl}/notifications`, {
				headers: { Authorization: `Bearer ${token}` }
			});
			setNotifications(res.data || []);
		} catch (err) {
			console.error("Error fetching notifications:", err);
		}
	};

	// Fetch Profile & Notifications on Mount
	useEffect(() => {
		const fetchProfileAndNotifications = async () => {
			try {
				const token = localStorage.getItem("token");
				if (!token) return;
				
				const profileRes = await axios.get(`${apiurl}/users/profile`, {
					headers: { Authorization: `Bearer ${token}` }
				});
				setProfileData(profileRes.data);
				
				if (profileRes.data.settings) {
					const localTheme = settings.theme;
					updateSettings({
						...profileRes.data.settings,
						theme: localTheme || profileRes.data.settings.theme || "light"
					});
				}

				fetchNotifications();
			} catch (err) {
				console.error("Error fetching profile details:", err);
			}
		};
		fetchProfileAndNotifications();
	}, []);

	// Escape key listener to close active dropdown
	useEffect(() => {
		const handleKeyDown = (event) => {
			if (event.key === "Escape") {
				if (openDropdownRef.current) {
					closeDropdown(openDropdownRef.current);
				}
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, []);

	// Lock body scroll when a dropdown is active
	useEffect(() => {
		if (openDropdown) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "";
		}
		return () => {
			document.body.style.overflow = "";
		};
	}, [openDropdown]);

	const handleLogout = () => {
		localStorage.removeItem("token");
		sessionStorage.removeItem("medinsight_dashboard_loaded");
		sessionStorage.setItem("medinsight_from_logout", "true");
		delete axios.defaults.headers.common["Authorization"];
		navigate("/login");
		window.location.reload();
	};

	const closeDropdown = (type) => {
		if (!type) return;
		setAnimatingOut(type);
		setOpenDropdown(null);
		setTimeout(() => {
			setAnimatingOut(current => current === type ? null : current);
		}, 220); // match transition duration (220ms)
	};

	const toggleDropdown = (type) => {
		if (openDropdown === type) {
			closeDropdown(type);
		} else {
			const previous = openDropdown;
			if (previous) {
				setAnimatingOut(previous);
				setOpenDropdown(type);
				setTimeout(() => {
					setAnimatingOut(current => current === previous ? null : current);
				}, 220);
			} else {
				setOpenDropdown(type);
				setAnimatingOut(null);
			}
		}
	};

	const handleMouseEnter = (type) => {
		if (closeTimerRef.current) {
			clearTimeout(closeTimerRef.current);
			closeTimerRef.current = null;
		}
		if (openDropdown !== type) {
			const previous = openDropdown;
			if (previous) {
				setAnimatingOut(previous);
				setOpenDropdown(type);
				setTimeout(() => {
					setAnimatingOut(current => current === previous ? null : current);
				}, 220);
			} else {
				setOpenDropdown(type);
				setAnimatingOut(null);
			}
		}
	};

	const handleMouseLeave = () => {
		if (closeTimerRef.current) {
			clearTimeout(closeTimerRef.current);
		}
		closeTimerRef.current = setTimeout(() => {
			if (openDropdownRef.current) {
				closeDropdown(openDropdownRef.current);
			}
		}, 180); // 180ms delay before closing to prevent flickering
	};

	// Notifications Operations via Backend API
	const markAsRead = async (id) => {
		try {
			const token = localStorage.getItem("token");
			await axios.put(`${apiurl}/notifications/${id}/read`, {}, {
				headers: { Authorization: `Bearer ${token}` }
			});
			setNotifications(prev =>
				prev.map(n => (n._id === id ? { ...n, read: true } : n))
			);
		} catch (err) {
			console.error("Error marking notification read:", err);
		}
	};

	const dismissNotification = async (e, id) => {
		e.stopPropagation();
		try {
			const token = localStorage.getItem("token");
			await axios.delete(`${apiurl}/notifications/${id}`, {
				headers: { Authorization: `Bearer ${token}` }
			});
			setNotifications(prev => prev.filter(n => n._id !== id));
		} catch (err) {
			console.error("Error dismissing notification:", err);
		}
	};

	const markAllRead = async () => {
		try {
			const token = localStorage.getItem("token");
			await axios.put(`${apiurl}/notifications/read-all`, {}, {
				headers: { Authorization: `Bearer ${token}` }
			});
			setNotifications(prev => prev.map(n => ({ ...n, read: true })));
		} catch (err) {
			console.error("Error marking all read:", err);
		}
	};

	const clearAllNotifications = async () => {
		try {
			const token = localStorage.getItem("token");
			await axios.delete(`${apiurl}/notifications`, {
				headers: { Authorization: `Bearer ${token}` }
			});
			setNotifications([]);
		} catch (err) {
			console.error("Error clearing notifications:", err);
		}
	};

	const handleNotificationClick = (notif) => {
		markAsRead(notif._id);
		closeDropdown("notifications");
		if (notif.link) {
			navigate(notif.link);
		}
	};

	// Settings Operations via Backend API
	const handleSettingToggle = (key) => {
		updateSettings({ [key]: !settings[key] });
	};

	const saveSettings = async () => {
		try {
			const token = localStorage.getItem("token");
			await axios.put(`${apiurl}/users/profile/settings`, settings, {
				headers: { Authorization: `Bearer ${token}` }
			});
			setSaveSuccess(true);
			setTimeout(() => {
				setSaveSuccess(false);
				closeDropdown("settings");
			}, 1000);
		} catch (err) {
			console.error("Error saving settings:", err);
		}
	};

	// Get unread notification count
	const unreadCount = notifications.filter(n => !n.read).length;

	// User initials helper
	const getInitials = () => {
		if (profileData && profileData.firstName && profileData.lastName) {
			return `${profileData.firstName[0].toUpperCase()}${profileData.lastName[0].toUpperCase()}`;
		}
		if (profileData && profileData.firstName) {
			return profileData.firstName[0].toUpperCase();
		}
		return "U";
	};

	// User full name helper
	const getFullName = () => {
		if (profileData && profileData.firstName) {
			return `${profileData.firstName} ${profileData.lastName || ""}`;
		}
		return "MedInsight User";
	};

	return (
		<>
			<div className={styles.navbar_container}>
				<nav className={styles.navbar}>
				{/* Left Section: Optional Actions + Logo */}
				<div className={styles.nav_left}>
					{leftActions && <div className={styles.custom_left_actions}>{leftActions}</div>}
					
					{/* Logo */}
					<div className={styles.logo_container} onClick={() => navigate("/")}>
						<FaHeartbeat className={styles.heart_icon} />
						<h1 className={styles.logo_text}>
							MedInsight<span className={styles.logo_accent}> AI</span>
						</h1>
					</div>
				</div>

				{/* Right Section: Notifications, Settings, Profile */}
				<div className={styles.nav_right}>
					
					{/* Notifications Dropdown */}
					<div
						className={styles.nav_item_wrapper}
						ref={notificationsRef}
						onMouseEnter={() => handleMouseEnter("notifications")}
						onMouseLeave={handleMouseLeave}
					>
						<button
							className={`${styles.nav_icon_btn} ${unreadCount > 0 ? styles.has_badge : ""}`}
							onClick={() => toggleDropdown("notifications")}
							title="Notifications"
							aria-label="Notifications"
						>
							<FaBell />
							{unreadCount > 0 && <span className={styles.notif_badge}>{unreadCount}</span>}
						</button>

						{(openDropdown === "notifications" || animatingOut === "notifications") && (
							<div className={`${styles.dropdown_menu} ${openDropdown === "notifications" ? styles.open : styles.closing}`}>
								<div className={styles.dropdown_header}>
									<h3>Notifications</h3>
									{unreadCount > 0 && (
										<button className={styles.header_action_btn} onClick={markAllRead}>
											Mark all as read
										</button>
									)}
								</div>
								
								<div className={styles.dropdown_body}>
									{notifications.length === 0 ? (
										<div className={styles.empty_state}>
											<FaBell className={styles.empty_icon} />
											<p>No new notifications</p>
										</div>
									) : (
										<div className={styles.notification_list}>
											{notifications.map(notif => (
												<div
													key={notif._id}
													className={`${styles.notif_item} ${!notif.read ? styles.unread : ""}`}
													onClick={() => handleNotificationClick(notif)}
												>
													<div className={`${styles.notif_icon_wrapper} ${styles[notif.type]}`}>
														{notif.type === "warning" && <FaExclamationTriangle />}
														{notif.type === "success" && <FaCheck />}
														{notif.type === "info" && <FaInfoCircle />}
														{notif.type === "danger" && <FaExclamationTriangle />}
													</div>
													<div className={styles.notif_content}>
														<p className={styles.notif_text}>{notif.message}</p>
														<span className={styles.notif_time}>{formatTime(notif.createdAt)}</span>
													</div>
													<button
														className={styles.dismiss_btn}
														onClick={(e) => dismissNotification(e, notif._id)}
														title="Dismiss"
													>
														<FaTimes />
													</button>
												</div>
											))}
										</div>
									)}
								</div>

								{notifications.length > 0 && (
									<div className={styles.dropdown_footer}>
										<button className={styles.footer_action_btn} onClick={clearAllNotifications}>
											Clear All
										</button>
									</div>
								)}
							</div>
						)}
					</div>

					{/* Settings Dropdown */}
					<div
						className={styles.nav_item_wrapper}
						ref={settingsRef}
						onMouseEnter={() => handleMouseEnter("settings")}
						onMouseLeave={handleMouseLeave}
					>
						<button
							className={styles.nav_icon_btn}
							onClick={() => toggleDropdown("settings")}
							title="Settings"
							aria-label="Settings"
						>
							<FaCog />
						</button>

						{(openDropdown === "settings" || animatingOut === "settings") && (
							<div className={`${styles.dropdown_menu} ${styles.settings_menu} ${openDropdown === "settings" ? styles.open : styles.closing}`}>
								<div className={styles.dropdown_header}>
									<h3>Settings & Preferences</h3>
								</div>

								<div className={styles.dropdown_body}>
									<div className={styles.settings_list}>
										
										{/* Theme Preference Toggle */}
										<div className={styles.setting_item}>
											<div className={styles.setting_info}>
												<span className={styles.setting_label}>Interface Theme</span>
												<span className={styles.setting_desc}>Toggle between light and dark interface.</span>
											</div>
											<button
												className={`${styles.theme_toggle_btn} ${settings.theme === "dark" ? styles.dark_active : ""}`}
												onClick={handleThemeToggle}
												title="Toggle Theme"
											>
												{settings.theme === "dark" ? <FaMoon /> : <FaSun />}
												<span>{settings.theme === "dark" ? "Dark Mode" : "Light Mode"}</span>
											</button>
										</div>

										{/* Email Alerts Toggle */}
										<div className={styles.setting_item}>
											<div className={styles.setting_info}>
												<span className={styles.setting_label}>Email Alerts</span>
												<span className={styles.setting_desc}>Notify on high/low biomarker reports.</span>
											</div>
											<label className={styles.switch}>
												<input
													type="checkbox"
													checked={settings.emailAlerts}
													onChange={() => handleSettingToggle("emailAlerts")}
												/>
												<span className={styles.slider}></span>
											</label>
										</div>

										{/* AI Insights Toggle */}
										<div className={styles.setting_item}>
											<div className={styles.setting_info}>
												<span className={styles.setting_label}>AI Recommendations</span>
												<span className={styles.setting_desc}>Receive personalized tips.</span>
											</div>
											<label className={styles.switch}>
												<input
													type="checkbox"
													checked={settings.aiInsights}
													onChange={() => handleSettingToggle("aiInsights")}
												/>
												<span className={styles.slider}></span>
											</label>
										</div>

										{/* Automatic Anomaly Detection */}
										<div className={styles.setting_item}>
											<div className={styles.setting_info}>
												<span className={styles.setting_label}>Auto Anomaly Alerts</span>
												<span className={styles.setting_desc}>Highlight biomarker warnings immediately.</span>
											</div>
											<label className={styles.switch}>
												<input
													type="checkbox"
													checked={settings.autoAnomaly}
													onChange={() => handleSettingToggle("autoAnomaly")}
												/>
												<span className={styles.slider}></span>
											</label>
										</div>

									</div>
								</div>

								<div className={styles.dropdown_footer}>
									<button
										className={`${styles.save_settings_btn} ${saveSuccess ? styles.save_success : ""}`}
										onClick={saveSettings}
										disabled={saveSuccess}
									>
										{saveSuccess ? (
											<>
												<FaCheck /> <span>Saved Successfully</span>
											</>
										) : (
											<span>Save Preferences</span>
										)}
									</button>
								</div>
							</div>
						)}
					</div>

					{/* Profile Avatar Dropdown */}
					<div
						className={styles.nav_item_wrapper}
						ref={profileRef}
						onMouseEnter={() => handleMouseEnter("profile")}
						onMouseLeave={handleMouseLeave}
					>
						<button
							className={styles.avatar_btn}
							onClick={() => toggleDropdown("profile")}
							title="User profile menu"
							aria-label="Profile menu"
						>
							<div className={styles.avatar_circle}>
								{profileData?.avatar ? (
									<img src={profileData.avatar} alt="Profile" className={styles.avatar_image} />
								) : (
									<span>{getInitials()}</span>
								)}
							</div>
						</button>

						{(openDropdown === "profile" || animatingOut === "profile") && (
							<div className={`${styles.dropdown_menu} ${openDropdown === "profile" ? styles.open : styles.closing}`}>
								<div className={styles.profile_user_info}>
									<div className={styles.profile_avatar_large}>
										{profileData?.avatar ? (
											<img src={profileData.avatar} alt="Profile" className={styles.avatar_image} />
										) : (
											<span>{getInitials()}</span>
										)}
									</div>
									<div className={styles.profile_user_details}>
										<h4>{getFullName()}</h4>
										<p>{profileData?.email || "loading..."}</p>
									</div>
								</div>
								
								<div className={styles.dropdown_divider}></div>
								
								<div className={styles.profile_links}>
									<button
										className={styles.profile_link_item}
										onClick={() => {
											closeDropdown("profile");
											if (location.pathname === "/") {
												showToast("You're already on the Dashboard.");
											} else {
												navigate("/");
											}
										}}
									>
										<FaThLarge className={styles.profile_link_icon} />
										<span>Dashboard</span>
									</button>
									<button
										className={styles.profile_link_item}
										onClick={() => {
											closeDropdown("profile");
											navigate("/profile");
										}}
									>
										<FaUser className={styles.profile_link_icon} />
										<span>My Profile</span>
									</button>
									<button
										className={styles.profile_link_item}
										onClick={() => {
											closeDropdown("profile");
											toggleDropdown("settings");
										}}
									>
										<FaCog className={styles.profile_link_icon} />
										<span>Settings & Toggles</span>
									</button>
								</div>

								<div className={styles.dropdown_divider}></div>

								<div className={styles.dropdown_footer_profile}>
									<button className={styles.dropdown_logout_btn} onClick={handleLogout}>
										<FaSignOutAlt />
										<span>Logout</span>
									</button>
								</div>
							</div>
						)}
					</div>

				</div>
			</nav>
			</div>

			{/* Backdrop Overlay */}
			{(openDropdown || animatingOut) && (
				<div
					className={`${styles.backdrop} ${openDropdown ? styles.backdrop_open : styles.backdrop_closing}`}
					onClick={() => closeDropdown(openDropdown || animatingOut)}
				/>
			)}

			{/* Toast Message Container */}
			{toast && (
				<div className={styles.toast_notification}>
					<FaInfoCircle className={styles.toast_icon} />
					<span>{toast}</span>
				</div>
			)}
		</>
	);
}

export default Navbar;
