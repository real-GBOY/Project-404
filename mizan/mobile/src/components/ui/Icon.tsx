import { MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";

/**
 * The design uses Google's "Material Symbols Rounded" web icon font as text
 * ligatures (e.g. `<span style="font-family:'Material Symbols Rounded'">
 * gavel</span>`). RN has no equivalent bundled ligature-font mechanism, so
 * each glyph used in the design is mapped by *meaning* to `@expo/vector-icons`
 * (MaterialIcons primary, MaterialCommunityIcons — a superset — for the
 * handful of names classic Material Icons lacks). This is a deliberate,
 * documented substitution, not a redesign: same icon, closest available
 * rendering.
 */
type MaterialIconsName = ComponentProps<typeof MaterialIcons>["name"];
type CommunityIconsName = ComponentProps<typeof MaterialCommunityIcons>["name"];

export type IconName =
  | "add"
  | "alarm"
  | "arrow_back"
  | "auto_awesome"
  | "badge"
  | "balance"
  | "calendar_month"
  | "call"
  | "check"
  | "check_circle"
  | "chevron_right"
  | "close"
  | "description"
  | "directions"
  | "document_scanner"
  | "download"
  | "event"
  | "event_available"
  | "event_repeat"
  | "expand_more"
  | "face"
  | "filter_list"
  | "folder_open"
  | "gavel"
  | "groups"
  | "history"
  | "how_to_reg"
  | "location_on"
  | "lock"
  | "logout"
  | "mail"
  | "mic"
  | "more_horiz"
  | "more_vert"
  | "note_add"
  | "notifications"
  | "offline_pin"
  | "pause"
  | "payments"
  | "photo_camera"
  | "picture_as_pdf"
  | "receipt_long"
  | "record_voice_over"
  | "search"
  | "send"
  | "share"
  | "shield"
  | "stop"
  | "task_alt"
  | "timer"
  | "today"
  | "visibility_off"
  | "warning";

const MATERIAL: Partial<Record<IconName, MaterialIconsName>> = {
  add: "add",
  alarm: "alarm",
  arrow_back: "arrow-back",
  auto_awesome: "auto-awesome",
  badge: "badge",
  call: "call",
  check: "check",
  check_circle: "check-circle",
  chevron_right: "chevron-right",
  close: "close",
  description: "description",
  directions: "directions",
  download: "download",
  event: "event",
  expand_more: "expand-more",
  face: "face",
  filter_list: "filter-list",
  folder_open: "folder-open",
  groups: "groups",
  history: "history",
  location_on: "location-on",
  lock: "lock",
  logout: "logout",
  mail: "mail",
  mic: "mic",
  more_horiz: "more-horiz",
  more_vert: "more-vert",
  notifications: "notifications",
  pause: "pause",
  payments: "payments",
  photo_camera: "photo-camera",
  picture_as_pdf: "picture-as-pdf",
  search: "search",
  send: "send",
  share: "share",
  shield: "shield",
  stop: "stop",
  task_alt: "task-alt",
  timer: "timer",
  today: "today",
  visibility_off: "visibility-off",
  warning: "warning",
};

/** Names classic Material Icons doesn't carry — MaterialCommunityIcons
 *  (a strict superset in practice) fills the gap. */
const COMMUNITY: Partial<Record<IconName, CommunityIconsName>> = {
  balance: "scale-balance",
  calendar_month: "calendar-month",
  document_scanner: "file-document-edit-outline",
  event_available: "calendar-check",
  event_repeat: "calendar-refresh",
  gavel: "gavel",
  how_to_reg: "account-check",
  note_add: "note-plus",
  offline_pin: "check-decagram",
  receipt_long: "receipt-text",
  record_voice_over: "microphone-message",
};

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: ComponentProps<typeof MaterialIcons>["style"];
}

export function Icon({ name, size = 22, color = "#16161D", style }: IconProps) {
  const materialName = MATERIAL[name];
  if (materialName) {
    return <MaterialIcons name={materialName} size={size} color={color} style={style} />;
  }
  const communityName = COMMUNITY[name];
  if (communityName) {
    return <MaterialCommunityIcons name={communityName} size={size} color={color} style={style} />;
  }
  // Should be unreachable — every IconName is mapped above.
  return <MaterialIcons name="help-outline" size={size} color={color} style={style} />;
}
