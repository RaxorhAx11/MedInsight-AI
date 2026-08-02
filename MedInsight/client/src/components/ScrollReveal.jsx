import React, { useEffect, useRef, useState } from "react";

const ScrollReveal = ({
    children,
    className = "",
    delay = 0,
    duration = 600,
    animation = "fade-slide-up",
    ...props
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const currentRef = ref.current;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    if (currentRef) {
                        observer.unobserve(currentRef);
                    }
                }
            },
            {
                threshold: 0.05,
                rootMargin: "0px 0px -20px 0px"
            }
        );

        if (currentRef) {
            observer.observe(currentRef);
        }

        return () => {
            if (currentRef) {
                observer.unobserve(currentRef);
            }
        };
    }, []);

    const styles = {
        transitionDuration: `${duration}ms`,
        transitionDelay: `${delay}ms`
    };

    return (
        <div
            ref={ref}
            className={`reveal-element reveal-${animation} ${isVisible ? "reveal-visible" : ""} ${className}`}
            style={{ ...styles, ...props.style }}
            {...props}
        >
            {children}
        </div>
    );
};

export default ScrollReveal;
