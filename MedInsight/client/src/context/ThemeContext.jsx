import React, { createContext, useState, useEffect, useContext } from "react";
import axios from "axios";

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
    const apiurl = process.env.REACT_APP_API_BASE_URL;

    const [settings, setSettings] = useState(() => {
        const saved = localStorage.getItem("medinsight_settings");
        return saved ? JSON.parse(saved) : {
            theme: "light",
            emailAlerts: true,
            aiInsights: true,
            autoAnomaly: true
        };
    });

    // Apply theme class to document body whenever theme setting changes
    useEffect(() => {
        if (settings.theme === "dark") {
            document.body.classList.add("dark-theme");
        } else {
            document.body.classList.remove("dark-theme");
        }
        localStorage.setItem("medinsight_settings", JSON.stringify(settings));
    }, [settings]);

    // Handle theme toggling with immediate backend sync
    const handleThemeToggle = async () => {
        const newTheme = settings.theme === "light" ? "dark" : "light";
        const newSettings = { ...settings, theme: newTheme };
        setSettings(newSettings);
        
        try {
            const token = localStorage.getItem("token");
            if (token) {
                await axios.put(`${apiurl}/users/profile/settings`, newSettings, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
        } catch (err) {
            console.error("Error auto-saving theme setting:", err);
        }
    };

    const updateSettings = (newSettings) => {
        setSettings(prev => ({ ...prev, ...newSettings }));
    };

    return (
        <ThemeContext.Provider value={{ settings, updateSettings, handleThemeToggle }}>
            {children}
        </ThemeContext.Provider>
    );
};
