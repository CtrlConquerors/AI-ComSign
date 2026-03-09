import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPracticeHistory } from './api/axios';
import type { PracticeSessionDto } from './utils';
import './Practice.css';

const PracticeHistoryPage: React.FC = () => {
    const [sessions, setSessions] = useState<PracticeSessionDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<Set<number>>(new Set());

    useEffect(() => {
        getPracticeHistory()
            .then(res => setSessions(res.data))
            .catch(() => setError('Failed to load history.'))
            .finally(() => setLoading(false));
    }, []);

    const toggleExpand = (id: number) => {
        setExpanded(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const fmt = (iso: string) =>
        new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

    return (
        <div className="practice-root">
            <div className="practice-shell">
                <header>
                    <h1 className="practice-title">Practice History</h1>
                    <p className="practice-subtitle">
                        Your past sessions — expand a row to see each sign result.
                    </p>
                </header>

                <div style={{ marginBottom: '1.5rem' }}>
                    <Link to="/practice" className="secondary-button small" style={{ textDecoration: 'none' }}>
                        ← Back to lessons
                    </Link>
                </div>

                {loading && <p className="practice-subtitle">Loading…</p>}
                {error && <p style={{ color: '#f87171' }}>{error}</p>}
                {!loading && !error && sessions.length === 0 && (
                    <p className="practice-subtitle">No sessions yet. Go practice!</p>
                )}

                <div className="history-list">
                    {sessions.map(session => {
                        const open = expanded.has(session.id);
                        return (
                            <div key={session.id} className="history-row">
                                <button
                                    type="button"
                                    className="history-row-header"
                                    onClick={() => toggleExpand(session.id)}
                                    style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'inherit' }}
                                >
                                    <div>
                                        <div className="history-row-title">{session.lessonTitle}</div>
                                        <div className="history-row-meta">
                                            {fmt(session.startDate)} · {session.passedSigns}/{session.totalSigns} correct
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <span className="history-row-score">{session.passRate}%</span>
                                        <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{open ? '▲' : '▼'}</span>
                                    </div>
                                </button>

                                {open && (
                                    <div className="history-row-detail">
                                        {session.attempts.map((a, i) => {
                                            const cls = a.isSkipped ? 'skip' : a.passed ? 'pass' : 'fail';
                                            const icon = a.isSkipped ? '⏭' : a.passed ? '✅' : '❌';
                                            return (
                                                <span key={i} className={`sign-chip ${cls}`}>
                                                    {icon} {a.signName}
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default PracticeHistoryPage;
