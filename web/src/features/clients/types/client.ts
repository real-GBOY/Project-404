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
  openMatters: number;
  outstanding: Money[];
  createdAt: string;
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
  notes: string | null;
  createdAt: string;
  stats: {
    openMatters: number;
    totalMatters: number;
    documents: number;
    outstanding: Money[];
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
  status: "open" | "on_hold" | "closed";
  openedAt: string;
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

export type ClientList = Paginated<ClientListItem>;

export interface ClientListParams {
  q?: string;
  status?: ClientStatus | "all";
  type?: ClientType | "all";
  sort?: string;
  page?: number;
}
