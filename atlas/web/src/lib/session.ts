/**
 * Frontend-only phase: there is no auth backend. The app renders as if a
 * demo user is already signed in (the design shows no login screen), so this
 * is a static session rather than a JWT/refresh flow. Swapping in real auth
 * later only means replacing this module.
 */
export interface Session {
  name: string;
  role: string;
  orgName: string;
}

export const currentSession: Session = {
  name: "Mostafa Halim",
  role: "Commercial Director",
  orgName: "Atlas Developments",
};
