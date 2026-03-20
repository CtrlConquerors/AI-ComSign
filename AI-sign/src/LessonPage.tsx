import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import './App.css'; // reuse existing typography/layout styles

// ---------- Types ----------

type LessonDto = {
    id: number;
    title: string;
    description?: string | null;
    level?: string | null; // matches Lesson.Level on the backend
};

// Matches backend Landmark (case-insensitive JSON mapping is fine)
type LandmarkDto = {
    x: number;
    y: number;
    z: number;
    visibility?: number | null;
};

// Matches backend SignSample returned by /api/sign/lesson/{lessonId}
type LessonSignDto = {
    id: number;
    signName: string;
    fileName?: string | null;
    landmarks: LandmarkDto[];
    lessonId: number | null;
    createdAt: string;
};

// ---------- Component ----------

const LessonPage: React.FC = () => {
    const [lessons, setLessons] = useState<LessonDto[]>([]);
    const [loadingLessons, setLoadingLessons] = useState<boolean>(true);
    const [lessonsError, setLessonsError] = useState<string | null>(null);

    const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
    const [lessonSigns, setLessonSigns] = useState<LessonSignDto[]>([]);
    const [loadingSigns, setLoadingSigns] = useState<boolean>(false);
    const [signsError, setSignsError] = useState<string | null>(null);

    // which sign in the current lesson the learner is on (for the practice panel)
    const [activeSignIndex, setActiveSignIndex] = useState<number>(0);

    const [fallbackVideoError, setFallbackVideoError] = useState<boolean>(false);

    // ---- load all lessons on mount ----
    useEffect(() => {
        const loadLessons = async () => {
            try {
                setLessonsError(null);
                const res = await fetch('/api/lessons');
                if (!res.ok) {
                    throw new Error(`Failed to load lessons (${res.status})`);
                }
                const data: LessonDto[] = await res.json();
                setLessons(data);
            } catch (err: unknown) {
                const message =
                    err instanceof Error ? err.message : 'Failed to load lessons';
                setLessonsError(message);
            } finally {
                setLoadingLessons(false);
            }
        };

        void loadLessons();
    }, []);

    // ---- when clicking a lesson, load its signs ----
    const handleSelectLesson = async (lessonId: number) => {
        if (lessonId === selectedLessonId) return; // no-op

        setSelectedLessonId(lessonId);
        setLessonSigns([]);
        setSignsError(null);
        setLoadingSigns(true);
        setActiveSignIndex(0); // reset to first sign

        try {
            const res = await fetch(`/api/sign/lesson/${lessonId}`);
            if (!res.ok) {
                throw new Error(
                    `Failed to load signs for lesson ${lessonId} (${res.status})`
                );
            }
            const data: LessonSignDto[] = await res.json();
            // Keep one representative sample per unique sign name
            const seen = new Set<string>();
            const unique = data.filter(s => {
                if (seen.has(s.signName)) return false;
                seen.add(s.signName);
                return true;
            });
            setLessonSigns(unique);
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : 'Failed to load lesson signs';
            setSignsError(message);
        } finally {
            setLoadingSigns(false);
        }
    };

    const activeSign =
        lessonSigns.length > 0 &&
            activeSignIndex >= 0 &&
            activeSignIndex < lessonSigns.length
            ? lessonSigns[activeSignIndex]
            : null;

    const handleNextSign = () => {
        setActiveSignIndex((prev) =>
            prev + 1 < lessonSigns.length ? prev + 1 : prev
        );
    };

    const handlePrevSign = () => {
        setActiveSignIndex((prev) => (prev - 1 >= 0 ? prev - 1 : prev));
    };

    // Vite public/ -> served at site root
    const publicVideoUrl = (signName: string) => {
        const key = signName.trim().toLowerCase();
        return `/${encodeURIComponent(key)}.mp4`;
    };

    // reset fallback state when sign changes
    useEffect(() => {
        setFallbackVideoError(false);
    }, [activeSign?.signName]);

    const fallbackSrc = useMemo(() => {
        if (!activeSign) return null;
        return publicVideoUrl(activeSign.signName);
    }, [activeSign]);

    const translatorUrl = useMemo(() => {
        if (!activeSign) return null;
        return `/translator?sign=${encodeURIComponent(activeSign.signName)}`;
    }, [activeSign]);

    return (
        <div className="app-root">
            <div className="app-shell">
                <header className="app-header">
                    <Link to="/" className="secondary-button small" style={{ textDecoration: 'none' }}>← Back to Home</Link>
                    <h1 className="app-title">
                        Lessons <span className="mode-tag">Practice path</span>
                    </h1>
                    <p className="app-subtitle">
                        Browse lessons from the dataset and practice each sign step by step.
                    </p>
                </header>

                <section className="lesson-layout">
                    {/* LEFT: lesson list */}
                    <div className="lesson-list">
                        <div className="section-head">
                            <p className="eyebrow">Lessons</p>
                            {loadingLessons && (
                                <p className="loading-text">Loading lessons…</p>
                            )}
                            {lessonsError && (
                                <p className="loading-text" style={{ color: '#f97373' }}>
                                    {lessonsError}
                                </p>
                            )}
                        </div>

                        <ul className="lesson-list-grid">
                            {lessons.map((lesson) => (
                                <li key={lesson.id}>
                                    <button
                                        type="button"
                                        className={
                                            'lesson-card' +
                                            (lesson.id === selectedLessonId
                                                ? ' lesson-card-selected'
                                                : '')
                                        }
                                        onClick={() => void handleSelectLesson(lesson.id)}
                                    >
                                        <div className="lesson-card-title-row">
                                            <span className="lesson-card-title">
                                                {lesson.title ?? `Lesson ${lesson.id}`}
                                            </span>
                                            {lesson.level && (
                                                <span className="lesson-badge">
                                                    {lesson.level}
                                                </span>
                                            )}
                                        </div>
                                        {lesson.description && (
                                            <p className="lesson-card-desc">
                                                {lesson.description}
                                            </p>
                                        )}
                                    </button>
                                </li>
                            ))}
                            {!loadingLessons && lessons.length === 0 && !lessonsError && (
                                <li className="loading-text">No lessons found.</li>
                            )}
                        </ul>
                    </div>

                    {/* RIGHT: lesson detail */}
                    <div className="lesson-detail">
                        <div className="section-head">
                            <p className="eyebrow">Lesson contents</p>
                            {selectedLessonId ? (
                                <h2>Signs in lesson #{selectedLessonId}</h2>
                            ) : (
                                <h2>Select a lesson to see its signs</h2>
                            )}
                        </div>

                        {selectedLessonId && (
                            <>
                                {loadingSigns && (
                                    <p className="loading-text">Loading signs…</p>
                                )}
                                {signsError && (
                                    <p className="loading-text" style={{ color: '#f97373' }}>
                                        {signsError}
                                    </p>
                                )}

                                {!loadingSigns && !signsError && (
                                    <div className="lesson-detail-grid">
                                        {/* Sign list scrolls */}
                                        <div className="lesson-signs-col">
                                            <ul className="lesson-sign-list">
                                                {lessonSigns.map((s, idx) => (
                                                    <li
                                                        key={s.id}
                                                        className={
                                                            'lesson-sign-item' +
                                                            (idx === activeSignIndex
                                                                ? ' lesson-sign-item-active'
                                                                : '')
                                                        }
                                                    >
                                                        <button
                                                            type="button"
                                                            className="lesson-sign-name"
                                                            onClick={() => setActiveSignIndex(idx)}
                                                        >
                                                            {s.signName}
                                                        </button>
                                                    </li>
                                                ))}
                                                {lessonSigns.length === 0 && (
                                                    <li className="loading-text">
                                                        No signs for this lesson yet.
                                                    </li>
                                                )}
                                            </ul>
                                        </div>

                                        {/* Sticky preview + controls */}
                                        <div className="lesson-preview-col">
                                            {activeSign && (
                                                <div className="lesson-practice-panel lesson-practice-panel--sticky">
                                                    <div className="lesson-practice-top">
                                                        <div>
                                                            <h3 className="lesson-now-title">
                                                                Now learning: <span className="lesson-now-sign">{activeSign.signName}</span>
                                                            </h3>
                                                            <p className="lesson-practice-hint">
                                                                Watch the sample, then try with your camera.
                                                            </p>
                                                        </div>

                                                        <div className="lesson-practice-actions lesson-practice-actions--compact">
                                                            <button
                                                                type="button"
                                                                onClick={handlePrevSign}
                                                                disabled={activeSignIndex === 0}
                                                            >
                                                                Previous
                                                            </button>

                                                            {translatorUrl ? (
                                                                <Link
                                                                    to={translatorUrl}
                                                                    className="secondary-button small"
                                                                    style={{ textDecoration: 'none' }}
                                                                >
                                                                    Practice
                                                                </Link>
                                                            ) : (
                                                                <button type="button" disabled>
                                                                    Practice
                                                                </button>
                                                            )}

                                                            <button
                                                                type="button"
                                                                onClick={handleNextSign}
                                                                disabled={activeSignIndex === lessonSigns.length - 1}
                                                            >
                                                                Next
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="lesson-skeleton-preview">
                                                        <p className="lesson-meta-row">
                                                            Stored landmarks: <strong>{activeSign.landmarks?.length ?? 0}</strong>
                                                        </p>

                                                        {fallbackSrc && !fallbackVideoError && (
                                                            <video
                                                                key={fallbackSrc}
                                                                className="lesson-sample-video"
                                                                src={fallbackSrc}
                                                                controls
                                                                playsInline
                                                                preload="metadata"
                                                                onError={() => setFallbackVideoError(true)}
                                                            />
                                                        )}

                                                        {fallbackSrc && fallbackVideoError && (
                                                            <p className="loading-text">
                                                                No sample video found at: <code>{fallbackSrc}</code>
                                                            </p>
                                                        )}

                                                        {activeSign.fileName && (
                                                            <p className="lesson-db-label">DB label: {activeSign.fileName}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {!selectedLessonId && (
                            <p className="loading-text">
                                Start by choosing a lesson from the list on the left.
                            </p>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default LessonPage;