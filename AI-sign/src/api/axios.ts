import axios from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';

// Single source of truth for the API base URL.
// - In Docker: Caddy proxies /api/* on the same origin, so we use a relative URL.
// - In dev: Vite dev server runs on 5173 and proxies /api/* to the backend (see vite.config.ts),
//   so we can also use a relative URL and avoid CORS issues entirely.
// - Set VITE_API_BASE_URL if you need to point the axios client at an absolute host
//   (e.g. talking to a backend on a different machine without using the dev proxy).
const baseURL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api';

const api = axios.create({
    baseURL,
    headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
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
