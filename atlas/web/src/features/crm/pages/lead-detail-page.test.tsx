import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { LeadDetailPage } from "./lead-detail-page";
import { ENDPOINTS } from "@/config/endpoints";
import type { LeadIntelligenceBrief, LeadRow } from "@/api/crm";
import type * as ConfigModule from "@/config";

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("@/config", async () => {
  const actual = await vi.importActual<typeof ConfigModule>("@/config");
  return { ...actual, get, post };
});

const LEAD_ID = "led_abc123";

const BASE_LEAD: LeadRow = {
  id: LEAD_ID,
  name: "Ahmed Mostafa",
  phone: "+201000000000",
  email: "ahmed@example.com",
  source: "referral",
  status: "qualified",
  stage: "qualified",
  score: 62,
  interestUnitId: null,
  interestText: "North Hills · 3-Bed",
  valueEgp: 6_400_000,
  agentId: "usr_agent",
  probabilityPct: null,
  expectedCloseDate: null,
  requirementsNotes: null,
  requirements: null,
  requirementsExtractedAt: null,
  lastActivityAt: "2026-09-10T00:00:00Z",
  createdAt: "2026-09-01T00:00:00Z",
};

const VALID_REQUIREMENTS: NonNullable<LeadRow["requirements"]> = {
  budgetMinEgp: 6_000_000,
  budgetMaxEgp: 7_500_000,
  locations: ["New Cairo"],
  propertyTypes: ["apartment"],
  bedroomsMin: 3,
  bedroomsMax: 3,
  preferredFloors: [1],
  deliveryWithinMonths: 24,
  otherPreferences: [],
  intent: "high",
  summary: "3BR apartment in New Cairo, 6-7.5M, first floor, within 2 years",
};

const MATCH: LeadIntelligenceBrief["matches"][number] = {
  id: "unt_1",
  code: "A-0301",
  projectId: "prj_1",
  projectName: "North Hills",
  unitType: "3-Bed",
  floor: 1,
  areaSqm: 178,
  basePriceEgp: 6_400_000,
  score: 94,
  reasons: [
    { key: "budget", met: true, label: "Within budget" },
    { key: "location", met: true, label: "In preferred location" },
  ],
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/leads/${LEAD_ID}`]}>
        <Routes>
          <Route path="/leads/:id" element={<LeadDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockDefaultGets(leadOverrides: Partial<typeof BASE_LEAD> = {}) {
  get.mockImplementation((url: string) => {
    if (url === ENDPOINTS.leads.byId(LEAD_ID)) return Promise.resolve({ ...BASE_LEAD, ...leadOverrides });
    if (url === ENDPOINTS.team) return Promise.resolve({ items: [{ id: "usr_agent", name: "Sara Fathy", email: "s@x.com", role: "Sales Agent", status: "active", assignedLeads: 3 }] });
    if (url === ENDPOINTS.activities.list) return Promise.resolve([]);
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

describe("LeadDetailPage", () => {
  it("shows a loading state while the lead is being fetched", () => {
    get.mockReturnValue(new Promise(() => {})); // never resolves
    renderPage();
    expect(screen.getByRole("status", { name: /loading/i })).toBeInTheDocument();
  });

  it("shows an error state with a retry action when the lead fails to load", async () => {
    const { ApiError } = await import("@/config");
    get.mockRejectedValue(new ApiError(500, { code: "internal", message: "Something broke" }));
    renderPage();
    await waitFor(() => expect(screen.getByText(/couldn't load this lead/i)).toBeInTheDocument());
    expect(screen.getByText("Something broke")).toBeInTheDocument();
  });

  it("shows an empty state when the lead doesn't exist", async () => {
    get.mockImplementation((url: string) => {
      if (url === ENDPOINTS.leads.byId(LEAD_ID)) return Promise.resolve(null);
      if (url === ENDPOINTS.team) return Promise.resolve({ items: [] });
      return Promise.resolve([]);
    });
    renderPage();
    await waitFor(() => expect(screen.getByText(/lead not found/i)).toBeInTheDocument());
  });

  it("renders lead details and lets the agent switch to the AI Intelligence tab", async () => {
    mockDefaultGets();
    renderPage();
    await waitFor(() => expect(screen.getByText("Ahmed Mostafa")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("tab", { name: "AI Intelligence" }));
    expect(screen.getByPlaceholderText(/looking for a 3 bedroom apartment/i)).toBeInTheDocument();
    expect(screen.getByText(/no requirements captured yet/i)).toBeInTheDocument();
  });

  it("shows previously-persisted requirements immediately, without needing a fresh analysis", async () => {
    mockDefaultGets({ requirements: VALID_REQUIREMENTS, requirementsNotes: "3BR New Cairo", requirementsExtractedAt: "2026-09-17T00:00:00Z" });
    renderPage();
    await waitFor(() => expect(screen.getByText("Ahmed Mostafa")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("tab", { name: "AI Intelligence" }));
    expect(screen.getByText(/3BR apartment in New Cairo/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate sales brief/i })).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("extracts requirements from notes and renders the structured summary", async () => {
    mockDefaultGets();
    post.mockResolvedValue({ ...BASE_LEAD, requirements: VALID_REQUIREMENTS, requirementsNotes: "3BR New Cairo", requirementsExtractedAt: "2026-09-17T00:00:00Z" });
    renderPage();
    await waitFor(() => expect(screen.getByText("Ahmed Mostafa")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("tab", { name: "AI Intelligence" }));

    const textarea = screen.getByPlaceholderText(/looking for a 3 bedroom apartment/i);
    fireEvent.change(textarea, { target: { value: "3BR New Cairo 6-7.5M" } });
    fireEvent.click(screen.getByRole("button", { name: /analyze requirements/i }));

    await waitFor(() => expect(screen.getByText(/3BR apartment in New Cairo/i)).toBeInTheDocument());
    expect(screen.getByText(/High Intent/i)).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith(ENDPOINTS.leads.aiRequirements(LEAD_ID), { notes: "3BR New Cairo 6-7.5M" });
  });

  it("shows a validation error state if requirement extraction fails", async () => {
    mockDefaultGets();
    const { ApiError } = await import("@/config");
    post.mockRejectedValue(new ApiError(400, { code: "request.invalid_body", message: "The request body is invalid." }));
    renderPage();
    await waitFor(() => expect(screen.getByText("Ahmed Mostafa")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("tab", { name: "AI Intelligence" }));
    fireEvent.change(screen.getByPlaceholderText(/looking for a 3 bedroom apartment/i), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: /analyze requirements/i }));
    await waitFor(() => expect(screen.getByText(/couldn't analyze these requirements/i)).toBeInTheDocument());
  });

  it("generates a sales brief with ranked matches, next action and an AI explanation", async () => {
    mockDefaultGets({ requirements: VALID_REQUIREMENTS, requirementsNotes: "3BR New Cairo", requirementsExtractedAt: "2026-09-17T00:00:00Z" });
    post.mockResolvedValue({
      requirements: VALID_REQUIREMENTS,
      requirementsNotes: "3BR New Cairo",
      requirementsExtractedAt: "2026-09-17T00:00:00Z",
      matches: [MATCH],
      nextAction: { action: "Schedule a site visit within 24 hours", reason: "A strong match (94% — A-0301) is available now." },
      explanation: "94% match because the unit is within budget and in the preferred location.",
      suggestedMessage: "Hi Ahmed, we found a great match for you!",
      aiGenerated: true,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Ahmed Mostafa")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("tab", { name: "AI Intelligence" }));
    fireEvent.click(screen.getByRole("button", { name: /generate sales brief/i }));

    await waitFor(() => expect(screen.getByText("A-0301")).toBeInTheDocument());
    expect(screen.getByText("94%")).toBeInTheDocument();
    expect(screen.getByText("Schedule a site visit within 24 hours")).toBeInTheDocument();
    expect(screen.getByText(/94% match because the unit is within budget/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Hi Ahmed, we found a great match for you!")).toBeInTheDocument();
    expect(screen.queryByText(/ai unavailable/i)).not.toBeInTheDocument();
  });

  it("shows the deterministic-fallback badge when the AI explanation was unavailable", async () => {
    mockDefaultGets({ requirements: VALID_REQUIREMENTS, requirementsExtractedAt: "2026-09-17T00:00:00Z" });
    post.mockResolvedValue({
      requirements: VALID_REQUIREMENTS,
      requirementsNotes: null,
      requirementsExtractedAt: "2026-09-17T00:00:00Z",
      matches: [MATCH],
      nextAction: { action: "Schedule a site visit within 24 hours", reason: "A strong match (94% — A-0301) is available now." },
      explanation: "A-0301 (North Hills) is the top match at 94%, on within budget, in preferred location.",
      suggestedMessage: "Hi Ahmed Mostafa, ...",
      aiGenerated: false,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Ahmed Mostafa")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("tab", { name: "AI Intelligence" }));
    fireEvent.click(screen.getByRole("button", { name: /generate sales brief/i }));
    await waitFor(() => expect(screen.getByText(/ai unavailable/i)).toBeInTheDocument());
  });

  it("shows an empty state within the brief when no units currently match", async () => {
    mockDefaultGets({ requirements: VALID_REQUIREMENTS, requirementsExtractedAt: "2026-09-17T00:00:00Z" });
    post.mockResolvedValue({
      requirements: VALID_REQUIREMENTS,
      requirementsNotes: null,
      requirementsExtractedAt: "2026-09-17T00:00:00Z",
      matches: [],
      nextAction: { action: "Present alternative projects or timelines", reason: "No available units currently satisfy these requirements." },
      explanation: "No available units currently satisfy the stated requirements.",
      suggestedMessage: "Hi Ahmed, we don't have an exact match right now...",
      aiGenerated: false,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Ahmed Mostafa")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("tab", { name: "AI Intelligence" }));
    fireEvent.click(screen.getByRole("button", { name: /generate sales brief/i }));
    await waitFor(() => expect(screen.getByText(/no available units match yet/i)).toBeInTheDocument());
  });

  it("shows an error state (e.g. permission denied) when generating the brief fails", async () => {
    mockDefaultGets({ requirements: VALID_REQUIREMENTS, requirementsExtractedAt: "2026-09-17T00:00:00Z" });
    const { ApiError } = await import("@/config");
    post.mockRejectedValue(new ApiError(403, { code: "auth.forbidden", message: "You do not have permission to do this." }));
    renderPage();
    await waitFor(() => expect(screen.getByText("Ahmed Mostafa")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("tab", { name: "AI Intelligence" }));
    fireEvent.click(screen.getByRole("button", { name: /generate sales brief/i }));
    await waitFor(() => expect(screen.getByText(/couldn't generate the sales brief/i)).toBeInTheDocument());
    expect(screen.getByText(/do not have permission/i)).toBeInTheDocument();
  });

  it("copies the suggested message to the clipboard without sending anything", async () => {
    mockDefaultGets({ requirements: VALID_REQUIREMENTS, requirementsExtractedAt: "2026-09-17T00:00:00Z" });
    post.mockResolvedValue({
      requirements: VALID_REQUIREMENTS,
      requirementsNotes: null,
      requirementsExtractedAt: "2026-09-17T00:00:00Z",
      matches: [MATCH],
      nextAction: { action: "Schedule a site visit within 24 hours", reason: "reason" },
      explanation: "explanation",
      suggestedMessage: "Hi Ahmed, draft message.",
      aiGenerated: true,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Ahmed Mostafa")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("tab", { name: "AI Intelligence" }));
    fireEvent.click(screen.getByRole("button", { name: /generate sales brief/i }));
    await waitFor(() => expect(screen.getByDisplayValue("Hi Ahmed, draft message.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /copy message/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Hi Ahmed, draft message."));
    expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument();
  });
});
