import type { Money, Paginated } from "@/types/api";

export type ClientType = "company" | "individual";
export type ClientStatus = "active" | "archived";

export interface ClientListItem {
  id: string;
  name: string;
  type: ClientType;
  status: ClientStatus;
  email: string | null;
  phone: string | null;
  city: string | null;
  contactName: string | null;
  partner: string | null;
  openMatters: number;
  totalMatters: number;
  outstanding: Money[];
  createdAt: string;
}

export interface ClientsSummary {
  total: number;
  companies: number;
  individuals: number;
  outstanding: Money[];
}

export interface Client {
  id: string;
  name: string;
  type: ClientType;
  status: ClientStatus;
  email: string | null;
  phone: string | null;
  taxId: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  createdAt: string;
  /** relationship partner */
  partner: string | null;
  /** "CR 118-4402 · Tax ID 204-118-993" or "National ID on file" */
  registration: string;
  stats: {
    openMatters: number;
    totalMatters: number;
    documents: number;
    outstanding: Money[];
    billedToDate: Money[];
    collected: Money[];
    unbilledHours: number;
  };
  primaryContact: ClientContact | null;
}

export interface ClientContact {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  primary: boolean;
}

export interface ClientMatterRow {
  id: string;
  reference: string;
  title: string;
  practiceArea: string;
  court: string | null;
  leadLawyer: string;
  status: "open" | "on_hold" | "closed";
  openedAt: string;
  nextHearing: string | null;
}

export interface ClientDocumentRow {
  id: string;
  name: string;
  matterTitle: string;
  category: string;
  status: string;
  uploadedAt: string;
}

export interface ClientInvoiceRow {
  id: string;
  number: string;
  status: string;
  currency: string;
  total: number;
  balance: number;
  issuedAt: string | null;
}

export interface ClientActivityRow {
  id: string;
  actor: string;
  action: string;
  target: string;
  at: string;
}

export type ClientList = Paginated<ClientListItem> & { summary: ClientsSummary };

export interface ClientListParams {
  q?: string;
  status?: ClientStatus | "all";
  type?: ClientType | "all";
  sort?: string;
  page?: number;
}
