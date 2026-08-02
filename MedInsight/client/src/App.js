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
        const hasVisited = localStorage.getItem("medinsight_visited");
        const queryParams = new URLSearchParams(window.location.search);
        const forceSplash = queryParams.get("splash") === "true";
        return !hasVisited || forceSplash;
    });

    useEffect(() => {
        if (showSplash) {
            localStorage.setItem("medinsight_visited", "true");
        }
    }, [showSplash]);

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

