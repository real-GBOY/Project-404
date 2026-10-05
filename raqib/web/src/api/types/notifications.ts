/** In-app notifications. */

/** A Core in-app notification (`GET /notifications`). `data.go` is `[route, id]` for the screen it concerns. */
export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: { go?: [string, string | null] } | null;
  read: boolean;
  createdAt: string;
}
