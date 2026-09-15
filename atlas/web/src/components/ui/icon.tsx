import {
  Search,
  Menu,
  Bell,
  Sparkles,
  Check,
  Clock,
  AlertTriangle,
  Target,
  Home,
  Building2,
  Building,
  User,
  FileText,
  Receipt,
  CheckCircle2,
  CircleDot,
  Circle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  X,
  Plus,
  LayoutGrid,
  Rows3,
  Download,
  Filter,
  Shield,
  Settings,
  Users,
  History,
  Send,
  Paperclip,
  MoreHorizontal,
  ArrowRight,
  Trash2,
  Pencil,
  LayoutDashboard,
  Kanban,
  Activity,
  CalendarClock,
  CalendarCheck,
  Tag,
  Bookmark,
  Handshake,
  FileSignature,
  CalendarRange,
  Percent,
  Layers,
  Wallet,
  CircleDollarSign,
  Landmark,
  ListChecks,
  Workflow,
  ClipboardCheck,
  TrendingUp,
  BarChart3,
  PieChart,
  Lightbulb,
  ThumbsUp,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Icon registry — maps the app's semantic icon names (unchanged from the original
 * hand-drawn glyph set, so every existing `<Icon name="…">` / `icon="…"` call site
 * keeps working) to real Lucide glyphs. Swapped in for legibility: the prior custom
 * 16x16 stroke paths read poorly at the 10-14px sizes most of the chrome uses them at.
 */
const ICONS: Record<string, LucideIcon> = {
  search: Search,
  menu: Menu,
  bell: Bell,
  spark: Sparkles,
  check: Check,
  clock: Clock,
  alert: AlertTriangle,
  lead: Target,
  unit: Home,
  customer: User,
  project: Building2,
  building: Building,
  doc: FileText,
  payment: Receipt,
  "step-done": CheckCircle2,
  "step-current": CircleDot,
  "step-pending": Circle,
  "chevron-down": ChevronDown,
  "chevron-up": ChevronUp,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  close: X,
  plus: Plus,
  grid: LayoutGrid,
  rows: Rows3,
  download: Download,
  filter: Filter,
  shield: Shield,
  gear: Settings,
  users: Users,
  history: History,
  send: Send,
  attach: Paperclip,
  more: MoreHorizontal,
  "arrow-right": ArrowRight,
  trash: Trash2,
  edit: Pencil,
  home: Home,

  /* ── sidebar nav (one per NAV item, see app/router/nav.ts) ─ */
  dashboard: LayoutDashboard,
  pipeline: Kanban,
  activity: Activity,
  followup: CalendarClock,
  availability: CalendarCheck,
  pricing: Tag,
  reservation: Bookmark,
  deal: Handshake,
  contract: FileSignature,
  "payment-plan": CalendarRange,
  commission: Percent,
  installment: Layers,
  collection: Wallet,
  outstanding: CircleDollarSign,
  report: Landmark,
  task: ListChecks,
  workflow: Workflow,
  approval: ClipboardCheck,
  "trend-up": TrendingUp,
  revenue: BarChart3,
  inventory: PieChart,
  insight: Lightbulb,
  recommendation: ThumbsUp,
  logout: LogOut,
};

export interface IconProps {
  /** Registered glyph name — see ICONS above. */
  name: keyof typeof ICONS | (string & {});
  className?: string;
  /** pixel size, sets both box and viewBox scale. Default 16. */
  size?: number;
  strokeWidth?: number;
  "aria-hidden"?: boolean;
  "aria-label"?: string;
}

/** A single Lucide glyph, resolved by the app's semantic icon name. */
export function Icon({
  name,
  className,
  size = 16,
  strokeWidth = 1.75,
  "aria-hidden": ariaHidden = true,
  "aria-label": ariaLabel,
}: IconProps) {
  const Cmp = ICONS[name];
  if (!Cmp) return null;
  return (
    <Cmp
      width={size}
      height={size}
      strokeWidth={strokeWidth}
      className={cn("flex-none select-none", className)}
      aria-hidden={ariaLabel ? undefined : ariaHidden}
      aria-label={ariaLabel}
      role={ariaLabel ? "img" : undefined}
    />
  );
}
