// Hugeicons-backed drop-in replacements for the icon names used across the app.
// Every consumer imports from '@/components/icons' instead of the old icon
// package, so existing JSX (<Search size={16} color="..." style={...} />)
// keeps working unchanged.
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Activity01Icon,
  Alert02Icon,
  Analytics01Icon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowReloadHorizontalIcon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  BookOpen01Icon,
  BotIcon,
  BubbleChatIcon,
  Bug01Icon,
  Building02Icon,
  BulbIcon,
  Calendar01Icon,
  Camera01Icon,
  Cancel01Icon,
  ClipboardCheckIcon,
  ClipboardPasteIcon,
  Clock01Icon,
  Copy01Icon,
  CpuIcon,
  DashboardSquare01Icon,
  Delete02Icon,
  Download01Icon,
  Download02Icon,
  File01Icon,
  FileUploadIcon,
  Fire02Icon,
  Flag01Icon,
  GameController02Icon,
  GraduationScrollIcon,
  Grid02Icon,
  GridIcon,
  Home01Icon,
  InformationCircleIcon,
  Layers01Icon,
  LibraryIcon,
  Link01Icon,
  Loading03Icon,
  Location01Icon,
  LockIcon,
  Logout01Icon,
  Mail01Icon,
  MapPinIcon,
  Maximize01Icon,
  Megaphone01Icon,
  Menu01Icon,
  Message01Icon,
  Minimize01Icon,
  Moon01Icon,
  Notification01Icon,
  Notification02Icon,
  PartyIcon,
  Pen01Icon,
  PencilEdit01Icon,
  PenTool01Icon,
  PlusSignIcon,
  RadioIcon,
  RefreshIcon,
  ScaleIcon,
  ScanLineIcon,
  Search01Icon,
  SentIcon,
  Share01Icon,
  Shield01Icon,
  Shield02Icon,
  ShuffleIcon,
  SparklesIcon,
  SquareArrowUpRightIcon,
  SquareIcon,
  Sun01Icon,
  SwordsIcon,
  Target01Icon,
  Tick02Icon,
  TickDouble01Icon,
  Timer01Icon,
  TrophyIcon,
  UserCheck01Icon,
  UserGroupIcon,
  UserIcon,
  Video01Icon,
  ViewIcon,
  ViewOffIcon,
  VolumeHighIcon,
  ZapIcon,
} from '@hugeicons/core-free-icons';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const make = (icon: any) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ({ size = 24, color = 'currentColor', strokeWidth = 1.5, ...rest }: any) => (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <HugeiconsIcon icon={icon as any} size={size} color={color} strokeWidth={strokeWidth} {...rest} />
  );
};

export const Activity = make(Activity01Icon);
export const AlertTriangle = make(Alert02Icon);
export const ArrowDown = make(ArrowDown01Icon);
export const ArrowDownToLine = make(Download01Icon);
export const ArrowLeft = make(ArrowLeft01Icon);
export const ArrowRight = make(ArrowRight01Icon);
export const ArrowUp = make(ArrowUp01Icon);
export const BarChart3 = make(Analytics01Icon);
export const Bell = make(Notification01Icon);
export const BellRing = make(Notification02Icon);
export const BookOpen = make(BookOpen01Icon);
export const Bot = make(BotIcon);
export const Bug = make(Bug01Icon);
export const Building2 = make(Building02Icon);
export const CalendarDays = make(Calendar01Icon);
export const Camera = make(Camera01Icon);
export const Check = make(Tick02Icon);
export const CheckCheck = make(TickDouble01Icon);
export const ChevronDown = make(ArrowDown01Icon);
export const ChevronLeft = make(ArrowLeft01Icon);
export const ChevronRight = make(ArrowRight01Icon);
export const ChevronUp = make(ArrowUp01Icon);
export const ClipboardCheck = make(ClipboardCheckIcon);
export const ClipboardPaste = make(ClipboardPasteIcon);
export const Clock = make(Clock01Icon);
export const Copy = make(Copy01Icon);
export const Cpu = make(CpuIcon);
export const Delete = make(Delete02Icon);
export const Download = make(Download02Icon);
export const ExternalLink = make(SquareArrowUpRightIcon);
export const Eye = make(ViewIcon);
export const EyeOff = make(ViewOffIcon);
export const FileText = make(File01Icon);
export const FileUp = make(FileUploadIcon);
export const Flag = make(Flag01Icon);
export const Flame = make(Fire02Icon);
export const Gamepad2 = make(GameController02Icon);
export const GraduationCap = make(GraduationScrollIcon);
export const Grid3x3 = make(GridIcon);
export const Home = make(Home01Icon);
export const Info = make(InformationCircleIcon);
export const Layers = make(Layers01Icon);
export const LayoutDashboard = make(DashboardSquare01Icon);
export const LayoutGrid = make(Grid02Icon);
export const LibraryBig = make(LibraryIcon);
export const Lightbulb = make(BulbIcon);
export const Link2 = make(Link01Icon);
export const Loader2 = make(Loading03Icon);
export const Lock = make(LockIcon);
export const LogOut = make(Logout01Icon);
export const Mail = make(Mail01Icon);
export const Map = make(MapPinIcon);
export const MapIcon = make(MapPinIcon);
export const MapPin = make(Location01Icon);
export const Maximize2 = make(Maximize01Icon);
export const Megaphone = make(Megaphone01Icon);
export const Menu = make(Menu01Icon);
export const MessageCircle = make(BubbleChatIcon);
export const MessageSquare = make(Message01Icon);
export const Minimize2 = make(Minimize01Icon);
export const Moon = make(Moon01Icon);
export const PartyPopper = make(PartyIcon);
export const Pencil = make(PencilEdit01Icon);
export const PenLine = make(Pen01Icon);
export const PenTool = make(PenTool01Icon);
export const Plus = make(PlusSignIcon);
export const Radio = make(RadioIcon);
export const RefreshCw = make(RefreshIcon);
export const RotateCcw = make(ArrowReloadHorizontalIcon);
export const Scale = make(ScaleIcon);
export const ScanLine = make(ScanLineIcon);
export const Search = make(Search01Icon);
export const Send = make(SentIcon);
export const Share2 = make(Share01Icon);
export const Shield = make(Shield01Icon);
export const ShieldAlert = make(Shield02Icon);
export const ShieldCheck = make(Shield01Icon);
export const Shuffle = make(ShuffleIcon);
export const Sparkles = make(SparklesIcon);
export const Square = make(SquareIcon);
export const Sun = make(Sun01Icon);
export const Swords = make(SwordsIcon);
export const Target = make(Target01Icon);
export const Timer = make(Timer01Icon);
export const Trash2 = make(Delete02Icon);
export const Trophy = make(TrophyIcon);
export const User = make(UserIcon);
export const UserCheck = make(UserCheck01Icon);
export const Users = make(UserGroupIcon);
export const Video = make(Video01Icon);
export const Volume2 = make(VolumeHighIcon);
export const X = make(Cancel01Icon);
export const Zap = make(ZapIcon);
