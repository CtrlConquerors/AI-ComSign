import './HomePage.css';
import { Link } from 'react-router-dom';

function HomePage() {
    return (
        <div className="homepage">
            {/* Top nav */}
            <header className="top-nav">
                <Link to="/" className="nav-logo">
                    <span className="nav-logo-mark" />
                    <span className="nav-logo-text">SignBridge</span>
                </Link>
                <nav className="nav-links">
                    <a href="#learning-path">Learn</a>
                    <a href="#practice">Practice</a>
                    <a href="#features">Features</a>
                    <Link to="/admin/extraction">Data Admin</Link>
                </nav>
                <Link className="nav-cta" to="/translator">
                    Open translator
                </Link>
            </header>

            {/* Hero */}
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

            {/* Why / Features placeholder */}
            <section className="section" id="features">
                {/* feature content here */}
            </section>

            {/* Learning path placeholder */}
            <section className="section path-section" id="learning-path">
                {/* learning path content here */}
            </section>

            {/* Final CTA */}
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