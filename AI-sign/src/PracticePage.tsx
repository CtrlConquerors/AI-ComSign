import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { startSession } from './api/axios';
import './Practice.css';

interface LessonDto {
    id: number;
    title: string;
    description?: string;
    level?: string;
    signs?: { id: number }[];
}

const PracticePage: React.FC = () => {
    const [lessons, setLessons] = useState<LessonDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [starting, setStarting] = useState<number | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const load = async () => {
            try {
                const res = await api.get<LessonDto[]>('/lessons');
                setLessons(res.data);
            } catch {
                setError('Failed to load lessons.');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const handleSelectLesson = async (lesson: LessonDto) => {
        if (starting !== null) return;
        setStarting(lesson.id);
        try {
            const res = await startSession(lesson.id);
            navigate('/practice/session', {
                state: {
                    sessionId: res.data.sessionId,
                    signNames: res.data.signNames,
                    lessonTitle: lesson.title,
                },
            });
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: string } })?.response?.data;
            setError(msg ?? 'Could not start session.');
            setStarting(null);
        }
    };

    return (
        <div className="practice-root">
            <div className="practice-shell">
                <header>
                    <Link to="/" className="secondary-button small" style={{ textDecoration: 'none' }}>← Back to Home</Link>
                    <h1 className="practice-title">Practice Mode</h1>
                    <p className="practice-subtitle">
                        Choose a lesson — sign each word on camera and get graded instantly.
                    </p>
                </header>

                {loading && <p className="practice-subtitle">Loading lessons…</p>}
                {error && <p style={{ color: '#f87171', marginBottom: '1rem' }}>{error}</p>}

                {!loading && lessons.length === 0 && !error && (
                    <p className="practice-subtitle">No lessons available yet.</p>
                )}

                <div className="lesson-grid">
                    {lessons.map((lesson) => (
                        <button
                            key={lesson.id}
                            type="button"
                            className="lesson-card"
                            onClick={() => handleSelectLesson(lesson)}
                            disabled={starting !== null}
                        >
                            <div className="lesson-card-title">
                                {starting === lesson.id ? 'Starting…' : lesson.title}
                            </div>
                            <div className="lesson-card-meta">
                                {lesson.level && <span>{lesson.level}</span>}
                                {lesson.signs && (
                                    <span>{lesson.signs.length} signs</span>
                                )}
                            </div>
                        </button>
                    ))}
                </div>

                <Link to="/practice/history" className="practice-subtitle" style={{ color: '#38bdf8' }}>
                    View practice history →
                </Link>
            </div>
        </div>
    );
};

export default PracticePage;
