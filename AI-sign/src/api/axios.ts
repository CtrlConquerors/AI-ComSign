import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:5197/api',
    headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;
import type {
  SessionStartedDto,
  AttemptDto,
  SessionSummaryDto,
  PracticeSessionDto,
  AdminPracticeStatsDto,
} from '../utils/types';

// Practice sessions
export const startSession = (lessonId: number) =>
  api.post<SessionStartedDto>('/practicesessions', { lessonId });

export const recordAttempt = (sessionId: number, dto: AttemptDto) =>
  api.post<{ id: number }>(`/practicesessions/${sessionId}/attempts`, dto);

export const finishSession = (sessionId: number) =>
  api.post<SessionSummaryDto>(`/practicesessions/${sessionId}/finish`);

export const getPracticeHistory = () =>
  api.get<PracticeSessionDto[]>('/practicesessions/history');

// Admin stats
export const getAdminPracticeStats = () =>
  api.get<AdminPracticeStatsDto>('/admin/practice-stats');

// Progress stats
export const getStatistics = () => api.get('/Progress/statistics');
export const getLecturerSummary = () => api.get('/Progress/lecturer-summary');
