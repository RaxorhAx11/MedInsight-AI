import React, { useState, useEffect, lazy, Suspense } from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import SplashScreen from "./components/SplashScreen";
import LoadingSpinner from "./components/LoadingSpinner";

const Main = lazy(() => import("./components/Main"));
const Chatbot = lazy(() => import("./components/Main/chatbot"));
const Signup = lazy(() => import("./components/Signup"));
const Login = lazy(() => import("./components/Login"));
const Reports = lazy(() => import("./components/Reports/reports"));
const LabReports = lazy(() => import("./components/Reports/labreports"));
const Results = lazy(() => import("./components/Reports/results"));
const Profile = lazy(() => import("./components/Main/profile"));
const BiomarkerExpanded = lazy(() => import("./components/Reports/BiomarkerExpanded"));
const AddReport = lazy(() => import("./components/Reports/AddReports"));
const ActivityHistory = lazy(() => import("./components/Main/ActivityHistory"));

function App() {
    const user = localStorage.getItem("token");
    const [showSplash, setShowSplash] = useState(() => {
        const queryParams = new URLSearchParams(window.location.search);
        if (queryParams.get("splash") === "true") {
            return true;
        }

        // Check if this is a browser reload/refresh
        let isReload = false;
        try {
            const navs = performance.getEntriesByType("navigation");
            if (navs.length > 0) {
                isReload = navs[0].type === "reload";
            } else {
                isReload = window.performance && window.performance.navigation && window.performance.navigation.type === 1;
            }
        } catch (e) {
            console.error("Error checking navigation type:", e);
        }

        const fromLogout = sessionStorage.getItem("medinsight_from_logout") === "true";
        if (fromLogout) {
            sessionStorage.removeItem("medinsight_from_logout");
        }

        // If it's a reload/refresh (and not triggered by logout), do not show splash
        if (isReload && !fromLogout) {
            return false;
        }

        const path = window.location.pathname;

        // Do not show splash screen on signup page
        if (path === "/signup") {
            return false;
        }

        // If user is logged in, show splash if it's the first time dashboard loads in this session
        if (user) {
            const dashboardLoaded = sessionStorage.getItem("medinsight_dashboard_loaded") === "true";
            if (path === "/") {
                return !dashboardLoaded;
            }
            return false;
        }

        // If user is not logged in, show splash on visit to the login page (or any redirect to login)
        return true;
    });

    useEffect(() => {
        if (!showSplash) {
            const user = localStorage.getItem("token");
            if (user && window.location.pathname === "/") {
                sessionStorage.setItem("medinsight_dashboard_loaded", "true");
            }
        }
    }, [showSplash]);

    useEffect(() => {
        const handlePageShow = () => {
            const token = localStorage.getItem("token");
            if (!token) {
                if (window.location.pathname !== "/login" && window.location.pathname !== "/signup") {
                    window.location.replace("/login");
                }
            }
        };

        const handleStorageChange = (e) => {
            if (e.key === "token" && !e.newValue) {
                window.location.replace("/login");
            }
        };

        window.addEventListener("pageshow", handlePageShow);
        window.addEventListener("storage", handleStorageChange);

        return () => {
            window.removeEventListener("pageshow", handlePageShow);
            window.removeEventListener("storage", handleStorageChange);
        };
    }, []);

    if (showSplash) {
        return <SplashScreen onComplete={() => setShowSplash(false)} />;
    }

    return (
        <Suspense fallback={<LoadingSpinner />}>
            <Routes>
                {/* Authenticated Routes */}
                {user && <Route path="/" element={<Main />} />}
                {user && <Route path="/chat" element={<Chatbot />} />}
                {user && <Route path="/reports" element={<Reports />} />}
                {user && <Route path="/reports/labreports" element={<LabReports />} />}
                {user && <Route path="/reports/results" element={<Results />} />}
                {user && <Route path="/reports/biomarker/:name" element={<BiomarkerExpanded />} />}
                {user && <Route path="/reports/add" element={<AddReport />} />}
                {user && <Route path="/profile" element={<Profile />} />}
                {user && <Route path="/activity" element={<ActivityHistory />} />}

                {/* Public Routes */}
                {!user && <Route path="/signup" element={<Signup />} />}
                {!user && <Route path="/login" element={<Login />} />}

                {/* Redirects */}
                {user ? (
                    <Route path="*" element={<Navigate to="/" />} />
                ) : (
                    <Route path="*" element={<Navigate to="/login" />} />
                )}
            </Routes>
        </Suspense>
    );
}

export default App;

