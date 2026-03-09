import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { getAdminPracticeStats } from '../api/axios';
import type { AdminPracticeStatsDto, PerSignStat } from '../utils';
import '../Practice.css';

interface DashboardStats {
    totalUsers: number;
    totalLessons: number;
    totalSigns: number;
}

const signClass = (s: PerSignStat): string => {
    if (s.passRate >= 70 && s.skipRate >= 30) return 'sign-ghost';
    if (s.passRate < 50 && s.skipRate >= 20) return 'sign-broken';
    if (s.passRate >= 70 && s.skipRate < 20) return 'sign-solid';
    return '';
};

const AdminDashboard: React.FC = () => {
    const [stats, setStats] = useState<DashboardStats>({
        totalUsers: 0,
        totalLessons: 0,
        totalSigns: 0
    });
    const [practiceStats, setPracticeStats] = useState<AdminPracticeStatsDto | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [dashRes, practiceRes] = await Promise.all([
                    api.get('/admin/users/stats'),
                    getAdminPracticeStats(),
                ]);
                setStats(dashRes.data);
                setPracticeStats(practiceRes.data);
            } catch (err) {
                console.error('Failed to load stats', err);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) return <div>Loading dashboard...</div>;

    return (
        <div>
            {/* ── Overview cards ─────────────────────────────────────────── */}
            <div className=admin-stats-grid>
                <div className=admin-stat-card>
                    <h3>Total Users</h3>
                    <p>{stats.totalUsers}</p>
                </div>
                <div className=admin-stat-card>
                    <h3>Total Lessons</h3>
                    <p>{stats.totalLessons}</p>
                </div>
                <div className=admin-stat-card>
                    <h3>Total Signs in Library</h3>
                    <p>{stats.totalSigns}</p>
                </div>
            </div>

            <div className=admin-table-container style={{ padding: '24px' }}>
                <h2>Welcome to the Admin Dashboard</h2>
                <p>Use the sidebar navigation to manage users, lessons, and the sign library.</p>
            </div>

            {/* ── Practice Stats ─────────────────────────────────────────── */}
            {practiceStats && (
                <div className=admin-table-container style={{ padding: '24px' }}>
                    <h2 style={{ marginBottom: '1.5rem' }}>Practice Stats</h2>

                    {/* By Learner */}
                    <h3 style={{ color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
                        By Learner
                    </h3>
                    <table className=summary-table style={{ marginBottom: '2rem' }}>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Sessions</th>
                                <th>Avg Pass Rate</th>
                            </tr>
                        </thead>
                        <tbody>
                            {practiceStats.perLearner.length === 0 && (
                                <tr><td colSpan={3} style={{ color: '#64748b' }}>No sessions yet.</td></tr>
                            )}
                            {practiceStats.perLearner.map(l => (
                                <tr key={l.learnerId}>
                                    <td>{l.name}</td>
                                    <td>{l.sessionCount}</td>
                                    <td style={{ color: l.avgPassRate >= 70 ? '#22c55e' : l.avgPassRate >= 50 ? '#eab308' : '#f87171' }}>
                                        {l.avgPassRate}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* By Lesson */}
                    <h3 style={{ color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
                        By Lesson
                    </h3>
                    <table className=summary-table style={{ marginBottom: '2rem' }}>
                        <thead>
                            <tr>
                                <th>Lesson</th>
                                <th>Avg Pass Rate</th>
                                <th>Hardest Signs</th>
                            </tr>
                        </thead>
                        <tbody>
                            {practiceStats.perLesson.length === 0 && (
                                <tr><td colSpan={3} style={{ color: '#64748b' }}>No data yet.</td></tr>
                            )}
                            {practiceStats.perLesson.map(l => (
                                <tr key={l.lessonId}>
                                    <td>{l.title}</td>
                                    <td style={{ color: l.avgPassRate >= 70 ? '#22c55e' : l.avgPassRate >= 50 ? '#eab308' : '#f87171' }}>
                                        {l.avgPassRate}%
                                    </td>
                                    <td style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                                        {l.hardestSigns.join(', ') || '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* By Sign (bottom signs by pass rate) */}
                    <h3 style={{ color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
                        By Sign
                        <span style={{ fontSize: '0.75rem', marginLeft: '0.75rem', fontWeight: 400, textTransform: 'none', color: '#64748b' }}>
                            🟡 Ghost Sign (avoid but pass) &nbsp; 🔴 Broken Sign (fail + skip) &nbsp; 🟢 Solid
                        </span>
                    </h3>
                    <table className=summary-table>
                        <thead>
                            <tr>
                                <th>Sign</th>
                                <th>Attempts</th>
                                <th>Pass Rate</th>
                                <th>Skip Rate</th>
                            </tr>
                        </thead>
                        <tbody>
                            {practiceStats.perSign.length === 0 && (
                                <tr><td colSpan={4} style={{ color: '#64748b' }}>No attempt data yet.</td></tr>
                            )}
                            {practiceStats.perSign.map(s => (
                                <tr key={s.signName} className={signClass(s)}>
                                    <td className=sign-name-cell>{s.signName}</td>
                                    <td>{s.totalAttempts}</td>
                                    <td>{s.passRate}%</td>
                                    <td>{s.skipRate}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
