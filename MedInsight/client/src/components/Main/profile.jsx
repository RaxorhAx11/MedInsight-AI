import React, { useEffect, useState } from "react";
import axios from "axios";
import styles from "./profile.module.css";
import { useNavigate } from "react-router-dom";
import Navbar from "../Navbar";
import { 
	FaChevronLeft, 
	FaBirthdayCake, 
	FaRulerVertical, 
	FaWeight, 
	FaUser,
	FaCamera
} from "react-icons/fa";

const apiurl = (() => {
	const base = (process.env.REACT_APP_API_BASE_URL || "http://localhost:8080").replace(/\/$/, "");
	return base.endsWith("/api") ? base : `${base}/api`;
})();

const Profile = () => {
    // State to hold profile data
    const [profileData, setProfileData] = useState(null);
    const navigate = useNavigate();
    const fileInputRef = React.useRef(null);

    // Edit profile state variables
    const [isEditing, setIsEditing] = useState(false);
    const [editFirstName, setEditFirstName] = useState("");
    const [editLastName, setEditLastName] = useState("");
    const [editAge, setEditAge] = useState("");
    const [editHeight, setEditHeight] = useState("");
    const [editWeight, setEditWeight] = useState("");
    const [editSex, setEditSex] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    
    const home = () => {
        navigate("/");
    };

    const handleStartEdit = () => {
        setEditFirstName(profileData.firstName || "");
        setEditLastName(profileData.lastName || "");
        setEditAge(profileData.age || "");
        setEditHeight(profileData.height || "");
        setEditWeight(profileData.weight || "");
        setEditSex(profileData.sex || "Male");
        setIsEditing(true);
    };

    const handleCancel = () => {
        setIsEditing(false);
    };

    const handleSave = async () => {
        if (!editFirstName.trim()) {
            alert("First Name is required.");
            return;
        }
        if (!editLastName.trim()) {
            alert("Last Name is required.");
            return;
        }
        const ageNum = parseInt(editAge);
        if (isNaN(ageNum) || ageNum < 0) {
            alert("Please enter a valid age (0 or greater).");
            return;
        }
        if (!editHeight.toString().trim()) {
            alert("Height is required.");
            return;
        }
        if (!editWeight.toString().trim()) {
            alert("Weight is required.");
            return;
        }
        if (!["Male", "Female", "Other"].includes(editSex)) {
            alert("Please select a valid biological sex.");
            return;
        }

        setIsSaving(true);
        try {
            const token = localStorage.getItem("token");
            const response = await axios.put(`${apiurl}/users/profile`, {
                firstName: editFirstName.trim(),
                lastName: editLastName.trim(),
                age: ageNum,
                height: editHeight.toString().trim(),
                weight: editWeight.toString().trim(),
                sex: editSex
            }, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            const updatedUser = response.data.user;
            const totalFields = 4;
            const completedFields = Object.keys(updatedUser).filter(
                (key) => ["age", "height", "weight", "sex"].includes(key) && updatedUser[key]
            ).length;
            updatedUser.progress = Math.round((completedFields / totalFields) * 100);

            setProfileData(prev => ({
                ...prev,
                ...updatedUser
            }));

            alert("Profile updated successfully!");
            setIsEditing(false);
        } catch (error) {
            console.error("Error updating profile:", error);
            if (error.response?.data?.message) {
                alert(error.response.data.message);
            } else {
                alert("Failed to update profile. Please try again.");
            }
        } finally {
            setIsSaving(false);
        }
    };

    const triggerAvatarUpload = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleAvatarChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            alert("Avatar image size must be less than 2MB.");
            return;
        }

        const formData = new FormData();
        formData.append("avatar", file);

        try {
            const token = localStorage.getItem("token");
            const response = await axios.post(`${apiurl}/users/profile/avatar`, formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                    Authorization: `Bearer ${token}`
                }
            });
            setProfileData(prev => ({ ...prev, avatar: response.data.avatarUrl }));
            alert("Profile picture uploaded successfully!");
            window.location.reload();
        } catch (error) {
            console.error("Error uploading avatar:", error);
            alert("Error uploading avatar. Please try again.");
        }
    };

    const getInitials = () => {
        if (profileData && profileData.firstName && profileData.lastName) {
            return `${profileData.firstName[0].toUpperCase()}${profileData.lastName[0].toUpperCase()}`;
        }
        if (profileData && profileData.firstName) {
            return profileData.firstName[0].toUpperCase();
        }
        return "U";
    };

    // Fetch data from the backend
    useEffect(() => {
        const fetchProfileData = async () => {
            try {
                const response = await axios.get(`${apiurl}/users/profile`);
                const totalFields = 4;
                const completedFields = Object.keys(response.data).filter(
                    (key) => ["age", "height", "weight", "sex"].includes(key) && response.data[key]
                ).length;

                response.data.progress = Math.round((completedFields / totalFields) * 100);
                setProfileData(response.data);
            } catch (error) {
                console.error("Error fetching profile data:", error);
            }
        };
        fetchProfileData();
    }, []);

    // Show loading state if data is not yet loaded
    if (!profileData) {
        return (
            <div className={styles.main_wrapper}>
                <div className={styles.loading_state}>
                    <p>Loading health profile...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.main_wrapper}>
            {/* Navbar */}
            <Navbar />

            <div className={styles.profile_container}>
                {/* Back and Title Section */}
                <header className={styles.header}>
					<div className={styles.header_left}>
						<button className={styles.back_btn} onClick={home} aria-label="Back to dashboard">
							<FaChevronLeft />
						</button>
						
						{/* Profile Picture Upload Circle */}
						<div className={styles.avatar_upload_container}>
							<div className={styles.avatar_upload_circle} onClick={triggerAvatarUpload} title="Change Profile Picture">
								{profileData.avatar ? (
									<img src={profileData.avatar} alt="Profile" className={styles.avatar_image} />
								) : (
									<span className={styles.avatar_initials}>{getInitials()}</span>
								)}
								<div className={styles.avatar_edit_overlay}>
									<FaCamera />
								</div>
							</div>
							<input
								type="file"
								ref={fileInputRef}
								style={{ display: "none" }}
								accept="image/*"
								onChange={handleAvatarChange}
							/>
						</div>

						<div className={styles.header_text}>
							{isEditing ? (
								<div className={styles.header_names_edit}>
									<input
										type="text"
										className={styles.input_field}
										value={editFirstName}
										onChange={(e) => setEditFirstName(e.target.value)}
										placeholder="First Name"
									/>
									<input
										type="text"
										className={styles.input_field}
										value={editLastName}
										onChange={(e) => setEditLastName(e.target.value)}
										placeholder="Last Name"
									/>
								</div>
							) : (
								<h2>{profileData.firstName} {profileData.lastName}</h2>
							)}
							<p>{profileData.email}</p>
						</div>
					</div>
					{isEditing ? (
						<div className={styles.edit_actions}>
							<button className={styles.edit_btn} onClick={handleSave} disabled={isSaving}>
								{isSaving ? "Saving..." : "Save"}
							</button>
							<button className={styles.cancel_btn} onClick={handleCancel} disabled={isSaving}>
								Cancel
							</button>
						</div>
					) : (
						<button className={styles.edit_btn} onClick={handleStartEdit}>
							Edit Profile
						</button>
					)}
                </header>

                {/* Progress Bar Card */}
                <div className={styles.progress_card}>
                    <div className={styles.progress_info}>
                        <span className={styles.progress_title}>Profile Completion Rate</span>
                        <strong className={styles.progress_percentage}>{profileData.progress}%</strong>
                    </div>
                    <div className={styles.progress_bar}>
                        <div
                            className={styles.progress_fill}
                            style={{ width: `${profileData.progress}%` }}
                        ></div>
                    </div>
                    <p className={styles.progress_hint}>
                        Complete your medical metadata to enable more personalized health alert reports.
                    </p>
                </div>

                {/* General Information Section */}
                <div className={styles.info_section}>
                    <h3>Baseline Health Metrics</h3>
                    
                    <div className={styles.info_container}>
                        {/* Left & Right Metrics Cards Grid */}
                        <div className={styles.metrics_grid}>
                            <div className={styles.info_card}>
                                <div className={styles.card_label_group}>
                                    <FaBirthdayCake className={styles.card_icon} />
                                    <span className={styles.info_label}>Age</span>
                                </div>
                                {isEditing ? (
                                    <input
                                        type="number"
                                        className={styles.input_field}
                                        value={editAge}
                                        onChange={(e) => setEditAge(e.target.value)}
                                        min="0"
                                    />
                                ) : (
                                    <strong className={styles.card_val}>{profileData.age ? `${profileData.age} yrs` : "Not provided"}</strong>
                                )}
                            </div>

                            <div className={styles.info_card}>
                                <div className={styles.card_label_group}>
                                    <FaRulerVertical className={styles.card_icon} />
                                    <span className={styles.info_label}>Height</span>
                                </div>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        className={styles.input_field}
                                        value={editHeight}
                                        onChange={(e) => setEditHeight(e.target.value)}
                                        placeholder="e.g. 175 cm"
                                    />
                                ) : (
                                    <strong className={styles.card_val}>{profileData.height ? (profileData.height.includes("cm") ? profileData.height : `${profileData.height} cm`) : "Not provided"}</strong>
                                )}
                            </div>

                            <div className={styles.info_card}>
                                <div className={styles.card_label_group}>
                                    <FaWeight className={styles.card_icon} />
                                    <span className={styles.info_label}>Weight</span>
                                </div>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        className={styles.input_field}
                                        value={editWeight}
                                        onChange={(e) => setEditWeight(e.target.value)}
                                        placeholder="e.g. 70 kg"
                                    />
                                ) : (
                                    <strong className={styles.card_val}>{profileData.weight ? (profileData.weight.includes("kg") ? profileData.weight : `${profileData.weight} kg`) : "Not provided"}</strong>
                                )}
                            </div>

                            <div className={styles.info_card}>
                                <div className={styles.card_label_group}>
                                    <FaUser className={styles.card_icon} />
                                    <span className={styles.info_label}>Biological Sex</span>
                                </div>
                                {isEditing ? (
                                    <select
                                        className={styles.select_field}
                                        value={editSex}
                                        onChange={(e) => setEditSex(e.target.value)}
                                    >
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                    </select>
                                ) : (
                                    <strong className={styles.card_val}>{profileData.sex || "Not provided"}</strong>
                                )}
                            </div>
                        </div>

                        {/* Center Avatar Graphic */}
                        <div className={styles.avatar_container}>
                            <img src="/images/body.svg" alt="Health representation illustration" className={styles.avatar} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;

