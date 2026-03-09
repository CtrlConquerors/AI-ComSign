import React, { useEffect, useState } from 'react';
import api from '../api/axios';

interface Lesson {
    id: number;
    title: string;
    description?: string | null;
    level?: string | null;
}

interface SignSample {
    id: number;
    signName: string;
    lessonId?: number | null;
}

interface LessonForm {
    title: string;
    description: string;
    level: string;
}

const emptyForm: LessonForm = { title: '', description: '', level: '' };

// ── Sign management panel ──────────────────────────────────────────────────

interface SignsPanelProps {
    lesson: Lesson;
    onClose: () => void;
}

const SignsPanel: React.FC<SignsPanelProps> = ({ lesson, onClose }) => {
    const [assigned, setAssigned] = useState<string[]>([]);
    const [library, setLibrary] = useState<string[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const [lessonSigns, allSigns] = await Promise.all([
                api.get<SignSample[]>(`/sign/lesson/${lesson.id}`),
                api.get<SignSample[]>('/sign'),
            ]);
            const assignedNames = [...new Set(lessonSigns.data.map(s => s.signName))].sort();
            const allNames = [...new Set(allSigns.data.map(s => s.signName))].sort();
            const available = allNames.filter(n => !assignedNames.includes(n));
            setAssigned(assignedNames);
            setLibrary(available);
        } catch (err) {
            console.error('Failed to load signs', err);
            alert('Failed to load signs.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [lesson.id]);

    const handleAdd = async (signName: string) => {
        try {
            await api.post(`/lessons/${lesson.id}/assign-by-names`, [signName]);
            await load();
        } catch (err) {
            console.error('Failed to add sign', err);
            alert('Failed to add sign.');
        }
    };

    const handleRemove = async (signName: string) => {
        if (!window.confirm(`Remove "${signName}" from this lesson?`)) return;
        try {
            await api.delete(`/lessons/${lesson.id}/signs/by-name/${encodeURIComponent(signName)}`);
            await load();
        } catch (err) {
            console.error('Failed to remove sign', err);
            alert('Failed to remove sign.');
        }
    };

    const filtered = library.filter(n => n.toLowerCase().includes(search.toLowerCase()));

    return (
        <tr>
            <td colSpan={5} style={{ padding: 0 }}>
                <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, margin: '0.25rem 0.5rem 0.75rem', padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0, color: '#f1f5f9', fontSize: '0.95rem' }}>
                            Signs in "{lesson.title}"
                        </h3>
                        <button className="admin-action-btn" onClick={onClose}>✕ Close</button>
                    </div>

                    {loading ? (
                        <p style={{ color: '#64748b' }}>Loading...</p>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            {/* Assigned signs */}
                            <div>
                                <p style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.5rem' }}>
                                    Assigned ({assigned.length})
                                </p>
                                <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                    {assigned.length === 0 && (
                                        <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No signs yet.</p>
                                    )}
                                    {assigned.map(name => (
                                        <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b', borderRadius: 6, padding: '0.35rem 0.6rem' }}>
                                            <span style={{ color: '#e2e8f0', fontSize: '0.875rem' }}>{name}</span>
                                            <button
                                                className="admin-action-btn delete"
                                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                                                onClick={() => handleRemove(name)}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Sign library */}
                            <div>
                                <p style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.5rem' }}>
                                    Sign Library ({library.length} available)
                                </p>
                                <input
                                    style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, color: '#f1f5f9', padding: '0.35rem 0.6rem', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box', marginBottom: '0.5rem' }}
                                    placeholder="Search signs..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                                <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                    {filtered.length === 0 && (
                                        <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No results.</p>
                                    )}
                                    {filtered.map(name => (
                                        <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b', borderRadius: 6, padding: '0.35rem 0.6rem' }}>
                                            <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>{name}</span>
                                            <button
                                                className="admin-action-btn promote"
                                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                                                onClick={() => handleAdd(name)}
                                            >
                                                + Add
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </td>
        </tr>
    );
};

// ── Main component ─────────────────────────────────────────────────────────

const AdminLessons: React.FC = () => {
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [managingId, setManagingId] = useState<number | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState<LessonForm>(emptyForm);

    useEffect(() => { fetchLessons(); }, []);

    const fetchLessons = async () => {
        try {
            const res = await api.get<Lesson[]>('/lessons');
            setLessons(res.data);
        } catch (err) {
            console.error('Failed to load lessons', err);
            alert('Failed to load lessons.');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!form.title.trim()) { alert('Title is required.'); return; }
        try {
            await api.post('/lessons', {
                title: form.title.trim(),
                description: form.description.trim() || null,
                level: form.level.trim() || null,
            });
            setShowCreate(false);
            setForm(emptyForm);
            fetchLessons();
        } catch (err) {
            console.error('Failed to create lesson', err);
            alert('Failed to create lesson.');
        }
    };

    const startEdit = (lesson: Lesson) => {
        setEditingId(lesson.id);
        setManagingId(null);
        setForm({ title: lesson.title, description: lesson.description ?? '', level: lesson.level ?? '' });
        setShowCreate(false);
    };

    const handleUpdate = async (id: number) => {
        if (!form.title.trim()) { alert('Title is required.'); return; }
        try {
            await api.put(`/lessons/${id}`, { id, title: form.title.trim(), description: form.description.trim() || null, level: form.level.trim() || null });
            setEditingId(null);
            setForm(emptyForm);
            fetchLessons();
        } catch (err) {
            console.error('Failed to update lesson', err);
            alert('Failed to update lesson.');
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Are you sure you want to delete this lesson?')) return;
        try {
            await api.delete(`/lessons/${id}`);
            if (managingId === id) setManagingId(null);
            fetchLessons();
        } catch (err) {
            console.error('Failed to delete lesson', err);
            alert('Failed to delete lesson.');
        }
    };

    const cancelEdit = () => { setEditingId(null); setForm(emptyForm); };
    const cancelCreate = () => { setShowCreate(false); setForm(emptyForm); };

    if (loading) return <div>Loading lessons...</div>;

    return (
        <div className="admin-table-container">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                <button
                    className="admin-action-btn promote"
                    onClick={() => { setShowCreate(true); setEditingId(null); setManagingId(null); setForm(emptyForm); }}
                >
                    + New Lesson
                </button>
            </div>

            {showCreate && (
                <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '1rem', marginBottom: '1.25rem' }}>
                    <h3 style={{ margin: '0 0 0.75rem', color: '#f1f5f9' }}>Create Lesson</h3>
                    <LessonFormFields form={form} onChange={setForm} />
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                        <button className="admin-action-btn promote" onClick={handleCreate}>Save</button>
                        <button className="admin-action-btn" onClick={cancelCreate}>Cancel</button>
                    </div>
                </div>
            )}

            <table className="admin-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Title</th>
                        <th>Level</th>
                        <th>Description</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {lessons.map(lesson => (
                        <React.Fragment key={lesson.id}>
                            <tr>
                                <td style={{ color: '#64748b' }}>{lesson.id}</td>
                                <td style={{ fontWeight: 500 }}>{lesson.title}</td>
                                <td>
                                    {lesson.level && (
                                        <span className="role-badge learner">{lesson.level}</span>
                                    )}
                                </td>
                                <td style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                                    {lesson.description ?? '—'}
                                </td>
                                <td>
                                    <button
                                        className="admin-action-btn"
                                        style={{ background: managingId === lesson.id ? '#1d4ed8' : undefined }}
                                        onClick={() => setManagingId(managingId === lesson.id ? null : lesson.id)}
                                    >
                                        Signs
                                    </button>
                                    <button className="admin-action-btn promote" onClick={() => startEdit(lesson)}>
                                        Edit
                                    </button>
                                    <button className="admin-action-btn delete" onClick={() => handleDelete(lesson.id)}>
                                        Delete
                                    </button>
                                </td>
                            </tr>

                            {managingId === lesson.id && (
                                <SignsPanel lesson={lesson} onClose={() => setManagingId(null)} />
                            )}

                            {editingId === lesson.id && (
                                <tr>
                                    <td colSpan={5} style={{ background: '#1e293b', padding: '1rem' }}>
                                        <LessonFormFields form={form} onChange={setForm} />
                                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                                            <button className="admin-action-btn promote" onClick={() => handleUpdate(lesson.id)}>Save</button>
                                            <button className="admin-action-btn" onClick={cancelEdit}>Cancel</button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </React.Fragment>
                    ))}
                    {lessons.length === 0 && (
                        <tr>
                            <td colSpan={5} style={{ textAlign: 'center', color: '#64748b' }}>No lessons found.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

// ── Form fields ────────────────────────────────────────────────────────────

interface FormFieldsProps {
    form: LessonForm;
    onChange: (f: LessonForm) => void;
}

const inputStyle: React.CSSProperties = {
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: 6,
    color: '#f1f5f9',
    padding: '0.4rem 0.6rem',
    fontSize: '0.875rem',
    width: '100%',
    boxSizing: 'border-box',
};

const LessonFormFields: React.FC<FormFieldsProps> = ({ form, onChange }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
        <label style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
            Title *
            <input style={inputStyle} value={form.title} onChange={e => onChange({ ...form, title: e.target.value })} placeholder="e.g. Greetings" />
        </label>
        <label style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
            Level
            <input style={inputStyle} value={form.level} onChange={e => onChange({ ...form, level: e.target.value })} placeholder="e.g. Beginner" />
        </label>
        <label style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
            Description
            <input style={inputStyle} value={form.description} onChange={e => onChange({ ...form, description: e.target.value })} placeholder="Short description" />
        </label>
    </div>
);

export default AdminLessons;
