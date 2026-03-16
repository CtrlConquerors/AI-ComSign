import './HomePage.css';
import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import api from './api/axios';

function HomePage() {
    const flashlightRef = useRef<HTMLDivElement | null>(null);
    const navigate = useNavigate();

    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
    const [userName, setUserName] = useState<string>("");

    // ADD: mobile nav state
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            setIsLoggedIn(true);
            fetchUserProfile();
        }

        const el = flashlightRef.current;
        if (!el) return;

        const handleMove = (e: MouseEvent) => {
            const { clientX, clientY } = e;
            el.style.setProperty('--fx-x', `${clientX}px`);
            el.style.setProperty('--fx-y', `${clientY}px`);
        };

        window.addEventListener('mousemove', handleMove);
        return () => window.removeEventListener('mousemove', handleMove);
    }, []);

    // ADD: close menu on resize to desktop
    useEffect(() => {
        const onResize = () => {
            if (window.innerWidth > 768) setIsMobileNavOpen(false);
        };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    const fetchUserProfile = async () => {
        try {
            const res = await api.get('/Auth/profile');
            setUserName(res.data.name);
        } catch (err) {
            console.error("Không lấy được profile:", err);
            handleLogout();
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        setIsLoggedIn(false);
        setIsMobileNavOpen(false); // ADD
        navigate('/');
    };

    // ADD: helper to close menu after clicking any nav item
    const closeMobileNav = () => setIsMobileNavOpen(false);

    return (
        <div className="homepage">
            <div className="flashlight-overlay" ref={flashlightRef} />

            <header className="top-nav">
                <Link to="/" className="nav-logo" onClick={closeMobileNav}>
                    <span className="nav-logo-mark" />
                    <span className="nav-logo-text">SignBridge</span>
                </Link>

                {/* ADD: hamburger only visible on mobile via CSS */}
                <button
                    type="button"
                    className="nav-toggle"
                    aria-label={isMobileNavOpen ? "Close menu" : "Open menu"}
                    aria-expanded={isMobileNavOpen}
                    aria-controls="top-nav-menu"
                    onClick={() => setIsMobileNavOpen((v) => !v)}
                >
                    <span className="nav-toggle-bar" />
                    <span className="nav-toggle-bar" />
                    <span className="nav-toggle-bar" />
                </button>

                {/* CHANGE: wrap links + CTA into one collapsible panel on mobile */}
                <div
                    id="top-nav-menu"
                    className={`nav-menu ${isMobileNavOpen ? "open" : ""}`}
                >
                    <nav className="nav-links">
                        <a href="#learning-path" onClick={closeMobileNav}>Learn</a>
                        <Link to="/practice" onClick={closeMobileNav}>Practice</Link>
                        <a href="#features" onClick={closeMobileNav}>Features</a>
                        <Link to="/admin" onClick={closeMobileNav}>Admin Dashboard</Link>
                        <Link to="/lessons" onClick={closeMobileNav}>Lesson</Link>

                        {!isLoggedIn ? (
                            <>
                                <Link to="/login" className="nav-link-auth" onClick={closeMobileNav}>Login</Link>
                                <Link to="/register" className="nav-link-auth" onClick={closeMobileNav}>Register</Link>
                            </>
                        ) : (
                            <div className="user-nav-group">
                                <span className="welcome-text">
                                    Chào, <strong className="hero-gradient">{userName}</strong>!
                                </span>
                                <button onClick={handleLogout} className="logout-btn">Logout</button>
                            </div>
                        )}
                    </nav>
                    
                </div>
                <Link className="nav-cta" to="/translator" onClick={closeMobileNav}>
                    Open translator
                </Link>
            </header>

            {/* rest unchanged */}
            <section className="hero">
                <div className="hero-grid">
                    <div className="hero-text">
                        <div className="hero-badge">
                            <span className="badge-dot" />
                            Learn • Practice • Translate
                        </div>
                        <h1>
                            Master sign language
                            <span className="hero-gradient"> with an AI practice partner.</span>
                        </h1>
                        <p className="hero-tagline">
                            Guided lessons, real‑time camera feedback, and a live text↔sign translator built to help you
                            communicate confidently with Deaf and hard‑of‑hearing communities.
                        </p>

                        <div className="hero-cta">
                            <Link className="pill-btn" to="/translator">
                                Start free session
                            </Link>
                            <a className="ghost-btn" href="#learning-path">
                                View learning path
                            </a>
                        </div>

                        <div className="hero-metrics">
                            <div className="metric-pill">
                                <span className="metric-label">Phrases</span>
                                <span className="metric-value">1k+</span>
                            </div>
                            <div className="metric-pill">
                                <span className="metric-label">Practice drills</span>
                                <span className="metric-value">Daily</span>
                            </div>
                            <div className="metric-pill">
                                <span className="metric-label">Languages</span>
                                <span className="metric-value">ASL · BSL · more</span>
                            </div>
                        </div>
                    </div>

                    <div className="hero-showcase">
                        <div className="showcase-card primary">
                            <div className="showcase-header">
                                <span className="showcase-title">Live translator</span>
                                <span className="showcase-dot" />
                            </div>
                            <div className="showcase-body">
                                <div className="showcase-screen">
                                    <div className="screen-top">
                                        <span className="screen-pill active">Text → Sign</span>
                                        <span className="screen-pill">Sign → Text</span>
                                    </div>
                                    <div className="screen-content">
                                        <p className="screen-text">“Can we meet tomorrow at 3 PM?”</p>
                                        <div className="screen-sign-row">
                                            <span className="screen-sign-hand">✋</span>
                                            <span className="screen-sign-hand">👌</span>
                                            <span className="screen-sign-hand">👉</span>
                                            <span className="screen-sign-hand">🕒</span>
                                        </div>
                                    </div>
                                    <Link className="screen-button" to="/translator">
                                        Open in Translator
                                    </Link>
                                </div>
                            </div>
                        </div>

                        <div className="showcase-column">
                            <div className="showcase-card compact" id="practice">
                                <p className="showcase-label">Camera practice</p>
                                <div className="mini-video-shell">
                                    <div className="mini-avatar">🙂</div>
                                    <div className="mini-wave">✋</div>
                                </div>
                                <p className="showcase-sub">
                                    Mirror your signing and get instant visual feedback.
                                </p>
                            </div>

                            <div className="showcase-card compact alt">
                                <p className="showcase-label">Daily streak</p>
                                <div className="streak-row">
                                    <span className="streak-fire">🔥</span>
                                    <span className="streak-count">7 days in a row</span>
                                </div>
                                <p className="showcase-sub">Stay consistent with bite‑sized drills.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <div className="wave-separator">
                <svg className="wave-svg" viewBox="0 0 1440 160" preserveAspectRatio="none">
                    <path
                        d="M0,96 C240,160 480,0 720,64 C960,128 1200,64 1440,96 L1440,160 L0,160 Z"
                        fill="#020617"
                    />
                </svg>
            </div>

            <section className="section" id="features" />
            <section className="section path-section" id="learning-path" />

            <section className="section narrow final-cta">
                <div className="section-head">
                    <p className="eyebrow">Ready when you are</p>
                    <h2>Open the live translator and start signing today.</h2>
                    <p className="section-sub">
                        No account required to try. Turn on your camera, type a phrase, and see it come to life in sign.
                    </p>
                    <div className="hero-cta">
                        <Link className="pill-btn" to="/translator">
                            Launch Translator
                        </Link>
                        <a className="ghost-btn" href="#features">
                            Explore features
                        </a>
                    </div>
                </div>
            </section>

            <footer className="footer">
                <span>© {new Date().getFullYear()} SignBridge.</span>
                <span className="footer-dot">•</span>
                <span>Built to make signing more accessible for everyone.</span>
            </footer>
        </div>
    );
}

export default HomePage;