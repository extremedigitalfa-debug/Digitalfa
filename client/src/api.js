// Tiny fetch wrapper that attaches the auth token.
export const tokenStore = {
  get: () => (typeof window !== "undefined" ? window.__digitalfaToken || null : null),
  set: (t) => { window.__digitalfaToken = t; },
  clear: () => { window.__digitalfaToken = null; },
};

async function request(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Errore di rete");
  return data;
}

const liveApi = {
  // auth & plans
  login: (email, password) => request("/login", { method: "POST", body: { email, password } }),
  register: (payload) => request("/register", { method: "POST", body: payload }),
  signup: (payload) => request("/signup", { method: "POST", body: payload }),
  forgotPassword: (email) => request("/auth/forgot", { method: "POST", body: { email } }),
  resetPassword: (token, password) => request("/auth/reset", { method: "POST", body: { token, password } }),
  me: () => request("/me"),
  demoAccounts: () => request("/demo-accounts"),
  plans: () => request("/plans"),
  // LinkedIn auth
  linkedinStart: () => request("/auth/linkedin/start"),
  linkedinSimulate: () => request("/auth/linkedin/simulate", { method: "POST" }),
  // billing
  getSubscription: () => request("/billing/subscription"),
  checkout: (planId) => request("/billing/checkout", { method: "POST", body: { planId } }),
  confirmCheckout: (planId, card, voucherCode) => request("/billing/confirm", { method: "POST", body: { planId, card, voucherCode } }),
  applyVoucher: (code) => request("/billing/apply-voucher", { method: "POST", body: { code } }),
  cancelSubscription: () => request("/billing/cancel", { method: "POST" }),
  resumeSubscription: () => request("/billing/resume", { method: "POST" }),
  billingPortal: () => request("/billing/portal", { method: "POST" }),
  // candidate
  candidateOverview: () => request("/candidate/overview"),
  candidateJobs: () => request("/candidate/jobs"),
  apply: (jobId, extra = {}) => request("/candidate/apply", { method: "POST", body: { jobId, ...extra } }),
  setApplied: (jobId, applied) => request(`/candidate/job/${jobId}/applied`, { method: "POST", body: { applied } }),
  applyCheck: (jobId) => request(`/candidate/job/${jobId}/apply-check`),
  jobOutreach: (jobId) => request(`/candidate/job/${jobId}/outreach`),
  jobCoverLetter: (jobId) => request(`/candidate/job/${jobId}/cover-letter`),
  jobCvTailored: (jobId) => request(`/candidate/job/${jobId}/cv-tailored`),
  jobAd: (jobId) => request(`/candidate/job/${jobId}/ad`),
  // onboarding
  onboardingOptions: () => request("/onboarding/options"),
  saveOnboarding: (payload) => request("/candidate/onboarding", { method: "POST", body: payload }),
  uploadCv: (fileName, dataBase64) => request("/candidate/cv", { method: "POST", body: { fileName, dataBase64 } }),
  // matching
  matchConfig: () => request("/match/config"),
  getMatchPrefs: () => request("/candidate/match-prefs"),
  setMatchPrefs: (weights) => request("/candidate/match-prefs", { method: "PUT", body: { weights } }),
  resetMatchPrefs: () => request("/candidate/match-prefs/reset", { method: "POST" }),
  jobFeedback: (jobId, verdict, note) => request(`/candidate/job/${jobId}/feedback`, { method: "POST", body: { verdict, note } }),
  adminMatchOverview: () => request("/admin/match-overview"),
  // coach
  coachCaseload: () => request("/coach/caseload"),
  coachCandidate: (id) => request(`/coach/candidate/${id}`),
  updateProgress: (candidateId, key, status) => request("/coach/progress", { method: "PATCH", body: { candidateId, key, status } }),
  // hr
  hrDashboard: () => request("/hr/dashboard"),
  hrPositions: () => request("/hr/positions"),
  hrCreatePosition: (payload) => request("/hr/positions", { method: "POST", body: payload }),
  hrUpdatePosition: (id, status) => request(`/hr/positions/${id}`, { method: "PATCH", body: { status } }),
  // admin
  adminOverview: () => request("/admin/overview"),
  adminUsers: () => request("/admin/users"),
  adminBlockUser: (id, days) => request(`/admin/users/${id}/block`, { method: "PATCH", body: { days } }),
  adminSetRole: (id, role, permissions) => request(`/admin/users/${id}/role`, { method: "PATCH", body: { role, permissions } }),
  adminDeleteUser: (id) => request(`/admin/users/${id}`, { method: "DELETE" }),
  adminCompanies: () => request("/admin/companies"),
  adminCreateCompany: (payload) => request("/admin/companies", { method: "POST", body: payload }),
  adminUpdateCompany: (id, payload) => request(`/admin/companies/${id}`, { method: "PATCH", body: payload }),
  adminSources: () => request("/admin/sources"),
  adminCreateSource: (payload) => request("/admin/sources", { method: "POST", body: payload }),
  adminUpdateSource: (id, payload) => request(`/admin/sources/${id}`, { method: "PATCH", body: payload }),
  adminScan: (id) => request(`/admin/sources/${id}/scan`, { method: "POST" }),
  adminTestSource: (id) => request(`/admin/sources/${id}/test`, { method: "POST" }),
  adminScanLogs: () => request("/admin/scan-logs"),
  adminScheduler: () => request("/admin/scheduler"),
  adminUpdateScheduler: (payload) => request("/admin/scheduler", { method: "PATCH", body: payload }),
  adminScanAll: () => request("/admin/scan-all", { method: "POST" }),
  adminGetConfig: () => request("/admin/config"),
  adminSaveConfig: (config) => request("/admin/config", { method: "PUT", body: { config } }),
  adminClearConfig: (keys) => request("/admin/config", { method: "PUT", body: { config: {}, clear: keys } }),
  adminTestEmail: (to) => request("/admin/config/test-email", { method: "POST", body: { to } }),
  adminTestConnector: (connector) => request("/admin/config/test-connector", { method: "POST", body: { connector } }),
  adminCandidateActivity: () => request("/admin/candidate-activity"),
  adminCandidateActivityDetail: (id) => request(`/admin/candidate-activity/${id}`),
  adminCandidateScanInfo: () => request("/admin/candidate-scan"),
  adminCandidateScanRun: () => request("/admin/candidate-scan", { method: "POST" }),
  adminPositions: (status) => request(`/admin/positions${status ? `?status=${status}` : ""}`),
  adminUpdatePosition: (id, status) => request(`/admin/positions/${id}`, { method: "PATCH", body: { status } }),
  adminForwardPosition: (id, to, fromName) => request(`/admin/positions/${id}/forward`, { method: "POST", body: { to, fromName } }),
  adminPurgeJobs: () => request("/admin/jobs/purge-simulated", { method: "POST" }),
  adminPurgeScanLogs: () => request("/admin/scan-logs/purge-simulated", { method: "POST" }),
  adminSetPassword: (id, password) => request(`/admin/users/${id}/set-password`, { method: "POST", body: { password } }),
  adminCoachApplications: () => request("/admin/coach-applications"),
  adminAlerts: () => request("/admin/alerts"),
  adminVouchers: () => request("/admin/vouchers"),
  adminVoucherCreate: (body) => request("/admin/vouchers", { method: "POST", body }),
  adminVoucherToggle: (id, active) => request(`/admin/vouchers/${id}`, { method: "PATCH", body: { active } }),
  adminVoucherDelete: (id) => request(`/admin/vouchers/${id}`, { method: "DELETE" }),
  adminCommunications: () => request("/admin/communications"),
  adminCommTest: (key, to) => request("/admin/communications/test", { method: "POST", body: { key, to } }),
  accountUpdateProfile: (body) => request("/account/profile", { method: "PUT", body }),
  accountChangePassword: (current, next) => request("/account/password", { method: "POST", body: { current, next } }),
  coachApply: (body) => request("/coach/apply", { method: "POST", body }),
  resourcesVideos: () => request("/resources/videos"),
  answersList: () => request("/candidate/answers"),
  answerSave: (body) => request("/candidate/answers", { method: "POST", body }),
  answerDelete: (id) => request(`/candidate/answers/${id}`, { method: "DELETE" }),
  answerGenerate: (question) => request("/candidate/answers/generate", { method: "POST", body: { question } }),
  jobApplyKit: (id) => request(`/candidate/job/${id}/apply-kit`),
  jobAutoApply: (id, submit) => request(`/candidate/job/${id}/auto-apply`, { method: "POST", body: { submit } }),
  jobAddManual: (url) => request("/candidate/job/add-manual", { method: "POST", body: { url } }),
  jobShare: (id, to) => request(`/candidate/job/${id}/share`, { method: "POST", body: { to } }),
  referralInfo: () => request("/candidate/referrals"),
  referralInvite: (email) => request("/candidate/referrals/invite", { method: "POST", body: { email } }),
};

// In the standalone demo build (VITE_DEMO=1) use the in-memory mock API,
// so the same UI runs entirely in the browser with no backend.
import { mockApi } from "./mockApi.js";
const DEMO = !!(import.meta.env && import.meta.env.VITE_DEMO);
export const api = DEMO ? mockApi : liveApi;
