import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './App.css'; // reuse existing typography/layout styles

type LessonDto = {
    id: number;
    title: string;
    description?: string | null;
    level?: string | null; // matches Lesson.Level on the backend
};

type LessonSignDto = {
    id: number;
    signName: string;
    lessonId: number;
};

const LessonPage: React.FC = () => {
    const [lessons, setLessons] = useState<LessonDto[]>([]);
    const [loadingLessons, setLoadingLessons] = useState<boolean>(true);
    const [lessonsError, setLessonsError] = useState<string | null>(null);

    const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
    const [lessonSigns, setLessonSigns] = useState<LessonSignDto[]>([]);
    const [loadingSigns, setLoadingSigns] = useState<boolean>(false);
    const [signsError, setSignsError] = useState<string | null>(null);

    // ---- load all lessons on mount ----
    useEffect(() => {
        const loadLessons = async () => {
            try {
                setLessonsError(null);
                // backend controller is LessonsController -> /api/lessons
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

        try {
            const res = await fetch(`/api/sign/lesson/${lessonId}`);
            if (!res.ok) {
                throw new Error(
                    `Failed to load signs for lesson ${lessonId} (${res.status})`
                );
            }
            const data: LessonSignDto[] = await res.json();
            setLessonSigns(data);
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : 'Failed to load lesson signs';
            setSignsError(message);
        } finally {
            setLoadingSigns(false);
        }
    };

    return (
        <div className="app-root">
            <div className="app-shell">
                <header className="app-header">
                    <h1 className="app-title">
                        Lessons <span className="mode-tag">Practice path</span>
                    </h1>
                    <p className="app-subtitle">
                        Browse lessons from the dataset and see which signs belong to each one.
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
                                    <ul className="lesson-sign-list">
                                        {lessonSigns.map((s) => (
                                            <li key={s.id} className="lesson-sign-item">
                                                <span className="lesson-sign-name">
                                                    {s.signName}
                                                </span>
                                                <Link
                                                    className="lesson-sign-link"
                                                    to={`/translator?sign=${encodeURIComponent(
                                                        s.signName
                                                    )}`}
                                                >
                                                    Practice
                                                </Link>
                                            </li>
                                        ))}
                                        {lessonSigns.length === 0 && (
                                            <li className="loading-text">
                                                No signs for this lesson yet.
                                            </li>
                                        )}
                                    </ul>
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