/**
 * Every backend route the frontend calls, in one place. Every `src/api/*.ts`
 * domain file builds its requests from this object instead of hand-writing
 * path strings — a typo or a backend route rename only ever needs fixing
 * here. Paths are relative to `API_BASE_URL` (see `env.ts`); dynamic segments
 * are functions.
 */
export const ENDPOINTS = {
  auth: {
    login: "/auth/login",
    refresh: "/auth/refresh",
    logout: "/auth/logout",
  },
  me: "/me",

  // Core messaging (core/messaging) — REST is history/resync/writes; the live path is the socket.
  conversations: {
    list: "/conversations",
    byId: (id: string) => `/conversations/${id}`,
    members: (id: string) => `/conversations/${id}/members`,
    messages: (id: string) => `/conversations/${id}/messages`,
    sync: (id: string) => `/conversations/${id}/sync`,
    read: (id: string) => `/conversations/${id}/read`,
    attachment: (id: string, attachmentId: string) => `/conversations/${id}/attachments/${attachmentId}`,
    // Atlas conversation intelligence (AI insights over a conversation)
    insights: (id: string) => `/realestate/conversations/${id}/insights`,
    insightsRefresh: (id: string) => `/realestate/conversations/${id}/insights/refresh`,
    applyRequirements: (id: string) => `/realestate/conversations/${id}/insights/apply-requirements`,
    createFollowup: (id: string) => `/realestate/conversations/${id}/insights/followups`,
  },
  files: {
    createUpload: "/files/uploads",
    confirm: (id: string) => `/files/${id}/confirm`,
  },
  team: "/team",

  leads: {
    list: "/realestate/leads",
    byId: (id: string) => `/realestate/leads/${id}`,
    trackAsDeal: (id: string) => `/realestate/leads/${id}/track-as-deal`,
    aiRequirements: (id: string) => `/realestate/leads/${id}/ai/requirements`,
    aiBrief: (id: string) => `/realestate/leads/${id}/ai/brief`,
  },
  customers: {
    list: "/realestate/customers",
    byId: (id: string) => `/realestate/customers/${id}`,
  },
  activities: {
    list: "/realestate/activities",
  },
  followups: {
    list: "/realestate/followups",
    status: (id: string) => `/realestate/followups/${id}/status`,
  },

  projects: {
    list: "/realestate/projects",
  },
  buildings: {
    list: "/realestate/buildings",
  },
  units: {
    list: "/realestate/units",
    generate: (buildingId: string) => `/realestate/units/buildings/${buildingId}/generate`,
    status: (id: string) => `/realestate/units/${id}/status`,
  },
  priceLists: {
    list: "/realestate/price-lists",
  },

  reservations: {
    list: "/realestate/reservations",
    cancel: (id: string) => `/realestate/reservations/${id}/cancel`,
  },
  contracts: {
    list: "/realestate/contracts",
    sign: (id: string) => `/realestate/contracts/${id}/sign`,
  },
  commissions: {
    list: "/realestate/commissions",
    status: (id: string) => `/realestate/commissions/${id}/status`,
  },
  paymentPlans: {
    list: "/realestate/payment-plans",
    byId: (id: string) => `/realestate/payment-plans/${id}`,
  },

  payments: {
    list: "/realestate/payments",
    collections: "/realestate/payments/collections",
    outstanding: "/realestate/payments/outstanding",
  },
  installments: {
    list: "/realestate/installments",
  },
  financialReports: {
    list: "/realestate/financial-reports",
  },

  tasks: {
    list: "/realestate/tasks",
    status: (id: string) => `/realestate/tasks/${id}/status`,
  },
  documents: {
    list: "/realestate/documents",
  },
  workflows: {
    list: "/realestate/workflows",
    advanceStep: (workflowId: string, seqNo: number) => `/realestate/workflows/${workflowId}/steps/${seqNo}/advance`,
  },
  approvals: {
    list: "/realestate/approvals",
    decide: (id: string) => `/realestate/approvals/${id}/decide`,
  },

  rbac: {
    roles: "/realestate/rbac/roles",
  },
  auditLogs: "/realestate/audit-logs",
  orgSettings: "/realestate/org-settings",
  notifications: {
    list: "/realestate/notifications",
    read: (id: string) => `/realestate/notifications/${id}/read`,
    readAll: "/realestate/notifications/read-all",
  },

  dashboard: "/realestate/dashboard",
  insights: {
    list: "/realestate/insights",
    dismiss: (id: string) => `/realestate/insights/${id}/dismiss`,
  },
  copilot: {
    conversations: "/realestate/copilot/conversations",
    conversation: (conversationId: string) => `/realestate/copilot/conversations/${conversationId}`,
    ask: "/realestate/copilot/ask",
  },
} as const;
