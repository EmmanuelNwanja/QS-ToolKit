import api from './api';

export const classroomAPI = {
  // ── Curriculum ──────────────────────────────────────────────
  getCourses:        ()                       => api.get('/classroom/curriculum/courses'),
  getCourseProgress: (courseId)               => api.get(`/classroom/curriculum/courses/${courseId}/progress`),
  startCourse:       (courseId)               => api.post(`/classroom/curriculum/courses/${courseId}/start`),
  getNextLesson:     (courseId)               => api.get(`/classroom/curriculum/courses/${courseId}/next-lesson`),
  completeLevel:     (courseId)               => api.post(`/classroom/curriculum/courses/${courseId}/complete-level`),
  generateCustomLesson: (data)                => api.post('/classroom/curriculum/lessons/generate-custom', data),
  // ── Lessons & Scenes ────────────────────────────────────────
  getLessons:        (params)                 => api.get('/classroom/lessons', { params }),
  getLesson:         (lessonId)               => api.get(`/classroom/lessons/${lessonId}`),
  generateSceneContent: (sceneId)             => api.post(`/classroom/scenes/${sceneId}/generate`),
  submitSceneResponse: (sceneId, data)        => api.post(`/classroom/scenes/${sceneId}/submit`, data),
  startDiscussion:   (sceneId)                => api.post(`/classroom/scenes/${sceneId}/discussion/start`),
  continueDiscussion: (sceneId, sessionId, data) => api.post(`/classroom/scenes/${sceneId}/discussion/continue`, { session_id: sessionId, ...data }),
  getLessonProgress: (lessonId)               => api.get(`/classroom/lessons/${lessonId}/progress`),
  deleteLesson:      (lessonId)               => api.delete(`/classroom/lessons/${lessonId}`),
  getAnalytics:      ()                       => api.get('/classroom/analytics'),
  // ── Migration ───────────────────────────────────────────────
  getMigrationStatus:    ()                       => api.get('/classroom/migrate/status'),
  migrateExamAttempt:    (attemptId)              => api.post(`/classroom/migrate/exam-prep/${attemptId}`),
  migrateAcademyLesson:  (lessonId)               => api.post(`/classroom/migrate/academy-lesson/${lessonId}`),
  migrateAcademySim:     (simId)                  => api.post(`/classroom/migrate/academy-sim/${simId}`),
  bulkMigrate:           ()                       => api.post('/classroom/migrate/bulk'),
};
