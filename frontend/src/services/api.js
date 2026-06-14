import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

function getOrCreateDeviceId() {
  if (typeof window === 'undefined') return null;
  const existing = localStorage.getItem('qst_device_id');
  if (existing) return existing;

  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `qst-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

  localStorage.setItem('qst_device_id', id);
  return id;
}

const api = axios.create({
  baseURL: API_URL,
  withCredentials: false,
  timeout: 30000
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('qst_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;

    const url = String(config.url || '');
    if (url.startsWith('/auth/')) {
      const deviceId = getOrCreateDeviceId();
      if (deviceId) config.headers['X-Device-Id'] = deviceId;
    }
  }
  return config;
});

// Handle 401 globally — redirect to login.
// Excluded: /auth/me (handled by authStore.init() which guards against token races)
// Excluded: any /auth/* page (user is mid-login; init() may still be resolving a stale token)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = String(error.config?.url || '');
    const isInitRequest = requestUrl === '/auth/me' || requestUrl.endsWith('/auth/me');
    const onAuthPage = typeof window !== 'undefined' && window.location.pathname.startsWith('/auth/');
    if (error.response?.status === 401 && !isInitRequest && !onAuthPage) {
      localStorage.removeItem('qst_token');
      localStorage.removeItem('qst_user');
      window.location.href = '/auth/login';
    }
    return Promise.reject(error);
  }
);

// ─── Auth ──────────────────────────────────────────────────────
export const authAPI = {
  register:           (data) => api.post('/auth/register', data),
  login:              (data) => api.post('/auth/login', data),
  googleLogin:        (token) => api.post('/auth/google', { access_token: token }),
  verifyEmail:        (token) => api.post('/auth/verify-email', { token }),
  resendVerification: (email) => api.post('/auth/resend-verification', { email }),
  me:                 ()     => api.get('/auth/me'),
  completeOnboarding: (data) => api.post('/auth/onboarding', data)
};

// ─── Users ─────────────────────────────────────────────────────
export const userAPI = {
  getProfile:          ()     => api.get('/users/profile'),
  updateProfile:       (data) => api.put('/users/profile', data),
  forceChangePassword: (data) => api.post('/users/password/force-change', data),
  updateBranding:      (data) => api.put('/users/branding', data),
  uploadLogo:          (file) => {
    const fd = new FormData(); fd.append('file', file);
    return api.post('/users/branding/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  uploadSignature:     (file) => {
    const fd = new FormData(); fd.append('file', file);
    return api.post('/users/branding/signature', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  getUsage:            ()     => api.get('/users/usage'),
  getTeam:             ()     => api.get('/users/team'),
  inviteMember:        (data) => api.post('/users/team/invite', data),
  acceptInvite:        (token)=> api.post(`/users/team/join/${token}`),
  removeMember:        (id)   => api.delete(`/users/team/${id}`),
  updateMemberRole:    (id, role) => api.patch(`/users/team/${id}/role`, { role }),
  hibernateAccount:    ()     => api.post('/users/account/hibernate'),
  deleteAccount:       ()     => api.delete('/users/account')
};

// ─── Projects ──────────────────────────────────────────────────
export const projectAPI = {
  list:           (params) => api.get('/projects', { params }),
  stats:          ()       => api.get('/projects/stats'),
  get:            (id)     => api.get(`/projects/${id}`),
  create:         (data)   => api.post('/projects', data),
  update:         (id, d)  => api.put(`/projects/${id}`, d),
  remove:         (id)     => api.delete(`/projects/${id}`),
  listMilestones: (id)     => api.get(`/projects/${id}/milestones`),
  createMilestone:(id, d)  => api.post(`/projects/${id}/milestones`, d),
  updateMilestone:(id, milestoneId, d) => api.patch(`/projects/${id}/milestones/${milestoneId}`, d),
  removeMilestone:(id, milestoneId)    => api.delete(`/projects/${id}/milestones/${milestoneId}`)
};

// ─── Calculators ───────────────────────────────────────────────
export const calcAPI = {
  concrete:   (d) => api.post('/calculators/concrete', d),
  masonry:    (d) => api.post('/calculators/masonry', d),
  plastering: (d) => api.post('/calculators/plastering', d),
  paint:      (d) => api.post('/calculators/paint', d),
  roofing:    (d) => api.post('/calculators/roofing', d),
  steel:      (d) => api.post('/calculators/steel', d),
  earthwork:  (d) => api.post('/calculators/earthwork', d),
  tiling:     (d) => api.post('/calculators/tiling', d),
  carpentry:          (d) => api.post("/calculators/carpentry", d),
  formwork:            (d) => api.post("/calculators/formwork", d),
  roofAccessories:     (d) => api.post("/calculators/roof-accessories", d),
  doorWindow:          (d) => api.post("/calculators/door-window", d),
  brcDpm:              (d) => api.post("/calculators/brc-dpm", d),
  save:       (d) => api.post("/calculators/save", d),
  getSaved:   (params) => api.get('/calculators/saved', { params })
};

// ─── BOQ ───────────────────────────────────────────────────────
export const boqAPI = {
  list:         (params) => api.get('/boq', { params }),
  create:       (data)   => api.post('/boq', data),
  get:          (id)     => api.get(`/boq/${id}`),
  update:       (id, d)  => api.put(`/boq/${id}`, d),
  remove:       (id)     => api.delete(`/boq/${id}`),
  addSection:   (id, d)  => api.post(`/boq/${id}/sections`, d),
  addItem:      (id, sid, d) => api.post(`/boq/${id}/sections/${sid}/items`, d),
  updateItem:   (id, sid, iid, d) => api.put(`/boq/${id}/sections/${sid}/items/${iid}`, d),
  removeItem:   (id, sid, iid) => api.delete(`/boq/${id}/sections/${sid}/items/${iid}`),
  exportPdf:    (id) => api.get(`/boq/${id}/export/pdf`, { responseType: 'blob' }),
  exportExcel:  (id) => api.get(`/boq/${id}/export/excel`, { responseType: 'blob' })
};

// ─── Invoices ──────────────────────────────────────────────────
export const invoiceAPI = {
  list:         (params) => api.get('/invoices', { params }),
  create:       (data)   => api.post('/invoices', data),
  get:          (id)     => api.get(`/invoices/${id}`),
  update:       (id, d)  => api.put(`/invoices/${id}`, d),
  remove:       (id)     => api.delete(`/invoices/${id}`),
  exportPdf:    (id)     => api.get(`/invoices/${id}/export/pdf`, { responseType: 'blob' }),
  exportExcel:  (id)     => api.get(`/invoices/${id}/export/excel`, { responseType: 'blob' }),
  send:         (id)     => api.post(`/invoices/${id}/send`)
};

// ─── Feedback ──────────────────────────────────────────────────
export const feedbackAPI = {
  createLink:    (data)  => api.post('/feedback/links', data),
  myLinks:       ()      => api.get('/feedback/my-links'),
  myFeedback:    ()      => api.get('/feedback/my-feedback'),
  deactivate:    (id)    => api.patch(`/feedback/links/${id}/deactivate`),
  getPublic:     (token) => api.get(`/feedback/public/${token}`),
  submit:        (token, d) => api.post(`/feedback/public/${token}`, d)
};

// ─── Leaderboard ───────────────────────────────────────────────
export const leaderboardAPI = {
  get:    (params) => api.get('/leaderboard', { params }),
  getMe:  ()       => api.get('/leaderboard/me')
};

// ─── Subscriptions ─────────────────────────────────────────────
export const subscriptionAPI = {
  getPlans:             ()                         => api.get('/subscriptions/plans'),
  getMy:                ()                         => api.get('/subscriptions/my'),
  initiate:             (plan, billing, promoCode) => api.post('/subscriptions/initiate', { plan_name: plan, billing_cycle: billing, promo_code: promoCode }),
  verify:               (ref)                      => api.get(`/subscriptions/verify?reference=${ref}`),
  validatePromo:        (code, plan_name)          => api.post('/subscriptions/validate-promo', { code, plan_name }),
  initiatePhilanthropist: (form, plan_name, billing_cycle) => api.post('/subscriptions/philanthropist', { ...form, plan_name, billing_cycle }),
  cancel:               ()                         => api.post('/subscriptions/cancel'),
  renew:                (billing_cycle)            => api.post('/subscriptions/renew', { billing_cycle }),
  setAutoRenew:         (enabled)                  => api.patch('/subscriptions/auto-renew', { enabled }),
  getBankTransferSettings: ()                    => api.get('/subscriptions/bank-transfer/settings'),
  submitBankTransfer:   (formData)                => api.post('/subscriptions/direct/submit-payment', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getMySubmissions:     ()                        => api.get('/subscriptions/direct/my-submissions'),
  getMyStatus:          ()                        => api.get('/subscriptions/status/current'),
  getMyAudit:           ()                        => api.get('/subscriptions/audit/history')
};

// ─── User Actions (admin) ──────────────────────────────────────
export const userActionsAPI = {
  suspend:              (userId, data) => api.post(`/user-actions/${userId}/suspend`, data),
  unsuspend:            (userId)       => api.post(`/user-actions/${userId}/unsuspend`),
  verify:               (userId)       => api.post(`/user-actions/${userId}/verify`),
  overrideSubscription: (userId, data) => api.post(`/user-actions/${userId}/subscription/override`, data),
  extendSubscription:   (userId, data) => api.post(`/user-actions/${userId}/subscription/extend`, data),
  revokeSubscription:   (userId, data) => api.post(`/user-actions/${userId}/subscription/revoke`, data),
  issueCredit:          (userId, data) => api.post(`/user-actions/${userId}/credit`, data),
  processRefund:        (userId, data) => api.post(`/user-actions/${userId}/refund`, data),
};

// ─── Admin ─────────────────────────────────────────────────────
export const adminAPI = {
  verify:                () => api.get('/admin/verify'),
  getStats:              () => api.get('/admin/stats'),
  getAdmins:             () => api.get('/admin/admins'),
  createAdmin:           (data) => api.post('/admin/admins', data),
  updateAdminPermissions: (adminId, data) => api.patch(`/admin/admins/${adminId}`, data),
  removeAdmin:           (adminId) => api.delete(`/admin/admins/${adminId}`),
  getPromoCodes:         () => api.get('/admin/promo-codes'),
  createPromoCode:       (data) => api.post('/admin/promo-codes', data),
  getPromoCodeDetail:    (codeId) => api.get(`/admin/promo-codes/${codeId}`),
  updatePromoCode:       (codeId, data) => api.patch(`/admin/promo-codes/${codeId}`, data),
  deletePromoCode:       (codeId) => api.delete(`/admin/promo-codes/${codeId}`),
  getUsers:              (params) => api.get('/admin/users', { params }),
  generateUserOneTimePassword: (userId, data) => api.post(`/admin/users/${userId}/one-time-password`, data),
  getSubscriptions:      (params) => api.get('/admin/subscriptions', { params }),
  getPaystackPlanMappings: () => api.get('/admin/paystack-plan-mappings'),
  updatePaystackPlanMapping: (planId, data) => api.patch(`/admin/paystack-plan-mappings/${planId}`, data),
  getBankTransferSettings: () => api.get('/admin/payment-settings/bank-transfer'),
  updateBankTransferSettings: (data) => api.put('/admin/payment-settings/bank-transfer', data),
  getDirectPayments:     (params) => api.get('/admin/payments/direct/list', { params }),
  getDirectPaymentDetail: (id) => api.get(`/admin/payments/direct/${id}`),
  verifyDirectPayment:   (id, adminNote) => api.post(`/admin/payments/direct/${id}/verify`, { adminNote }),
  rejectDirectPayment:   (id, reason) => api.post(`/admin/payments/direct/${id}/reject`, { reason }),
  getDirectPaymentStats: () => api.get('/admin/payments/direct/stats/overview'),
  getPushNotifications:  () => api.get('/admin/notifications'),
  sendPushNotification:  (data) => api.post('/admin/notifications', data),
  getActivityLogs:       (params) => api.get('/admin/activity-logs', { params }),
  getAnalytics:          (params) => api.get('/admin/analytics', { params }),
  getAcademyStats:       ()       => api.get('/admin/academy/stats'),
  getExamPrepStats:      ()       => api.get('/admin/exam-prep/stats'),
};

// ─── Push Notifications ────────────────────────────────────────
export const pushAPI = {
  getSubscriptionStatus: ()     => api.get('/push-notifications/subscription-status'),
  subscribe:             (data) => api.post('/push-notifications/subscribe', data),
  unsubscribe:           (data) => api.post('/push-notifications/unsubscribe', data),
  getInbox:              (params) => api.get('/push-notifications/inbox', { params }),
  markDeliveryRead:      (id)   => api.patch(`/push-notifications/inbox/${id}/read`),
  getActivity:           (params) => api.get('/push-notifications/activity', { params }),
  markActivityRead:      (id)   => api.patch(`/push-notifications/activity/${id}/read`)
};

// ─── AI ────────────────────────────────────────────────────────
export const aiAPI = {
  chat:              (data)   => api.post('/ai/chat', data),
  chatHistory:       (params) => api.get('/ai/chat/history', { params }),
  analyzeDrawing:    (data)   => api.post('/ai/drawings/analyze', data, { timeout: 120000 }),
  drawingJobs:       ()       => api.get('/ai/drawings/jobs'),
  drawingJob:        (id)     => api.get(`/ai/drawings/jobs/${id}`),
  forecast:          (projectId) => api.get(`/ai/forecast/${projectId}`),
  suggestRate:       (params) => api.get('/ai/rates/suggest', { params }),
  adminQuery:        (data)   => api.post('/ai/admin/query', data),
  adminChat:         (data)   => api.post('/ai/admin/chat', data),
  adminChatHistory:  ()       => api.get('/ai/admin/chat/history'),
  grantAdminAI:      (data)   => api.post('/ai/admin/grant', data),
  revokeAdminAI:     (userId) => api.delete(`/ai/admin/grant/${userId}`),
  listAdminAIGrants: ()       => api.get('/ai/admin/grants')
};

// ─── Integrity / Blockchain-lite ───────────────────────────────
export const integrityAPI = {
  certifyBoq:     (id) => api.post(`/integrity/boq/${id}/certify`),
  certifyInvoice: (id) => api.post(`/integrity/invoice/${id}/certify`),
  verify:         (token) => api.get(`/integrity/verify/${token}`),
  history:        (type, id) => api.get(`/integrity/history/${type}/${id}`),
  downloadCert:   (token) => api.get(`/integrity/certificate/${token}/download`, { responseType: 'blob' })
};

// ─── BOQ Revisions / Variance ──────────────────────────────────
export const revisionAPI = {
  list:     (boqId) => api.get(`/boq/${boqId}/revisions`),
  get:      (boqId, revId) => api.get(`/boq/${boqId}/revisions/${revId}`),
  variance: (boqId, revA, revB) => api.get(`/boq/${boqId}/variance`, { params: { rev_a: revA, rev_b: revB } })
};

// ─── QS Academy ────────────────────────────────────────────────
export const academyAPI = {
  getStatus:       ()                         => api.get('/academy/status'),
  subscribe:       (data)                     => api.post('/academy/subscribe', data),
  getProfile:       ()                        => api.get('/academy/profile'),
  saveProfile:      (data)                    => api.post('/academy/profile', data),
  startAdmission:   ()                        => api.post('/academy/admission/start'),
  submitAdmission:  (data)                    => api.post('/academy/admission/submit', data),
  getAdmissionResult: ()                      => api.get('/academy/admission/result'),
  getPathways:      ()                        => api.get('/academy/pathways'),
  getPathway:       (slug)                    => api.get(`/academy/pathways/${slug}`),
  enrollPathway:    (slug)                    => api.post(`/academy/pathways/${slug}/enroll`),
  getProgress:      ()                        => api.get('/academy/pathways/progress'),
  getResources:     (params)                  => api.get('/academy/resources', { params }),
  getResource:      (id)                      => api.get(`/academy/resources/${id}`),
  createContest:    (data)                    => api.post('/academy/contests', data),
  getContests:      (params)                  => api.get('/academy/contests', { params }),
  joinContest:      (id)                      => api.post(`/academy/contests/${id}/join`),
  submitContest:    (id, data)                => api.post(`/academy/contests/${id}/submit`, data),
  getContestResults: (id)                     => api.get(`/academy/contests/${id}/results`),
  getTokens:        ()                        => api.get('/academy/tokens'),
  getAnalytics:     ()                        => api.get('/academy/analytics'),
};

// ─── QS Exam Prep ─────────────────────────────────────────────
export const examAPI = {
  getStatus:          ()                      => api.get('/exam-prep/status'),
  subscribe:          (data)                  => api.post('/exam-prep/subscribe', data),
  getExams:           (params)                => api.get('/exam-prep/exams', { params }),
  getExamQuestions:    (id, params)            => api.get(`/exam-prep/exams/${id}/questions`, { params }),
  startExam:          (id)                    => api.post(`/exam-prep/exams/${id}/start`),
  submitExam:         (id, data)              => api.post(`/exam-prep/exams/${id}/submit`, data),
  getAttempts:        ()                      => api.get('/exam-prep/attempts'),
  getAttempt:         (id)                    => api.get(`/exam-prep/attempts/${id}`),
  getUniversities:    ()                      => api.get('/exam-prep/universities'),
  getUniversityCourses: (id)                  => api.get(`/exam-prep/universities/${id}/courses`),
  getPastQuestions:    (params)               => api.get('/exam-prep/past-questions', { params }),
};

// ─── Utilities ─────────────────────────────────────────────────
export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(new Blob([blob]));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export default api;
