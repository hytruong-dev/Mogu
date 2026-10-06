import * as Lucide from 'lucide-react-native';
import type { LucideIcon, LucideProps } from 'lucide-react-native';
import { moguBrand } from '@/theme/brand';
import {
  MoguExploreIcon,
  MoguHealthIcon,
  MoguHomeIcon,
  MoguProfileIcon,
  MoguRandomIcon,
} from './navigation-icons';

export type { LucideIcon, LucideProps } from 'lucide-react-native';

/**
 * Applies Mogu's rounded, warm icon language to the complete existing Lucide set.
 * Existing screens can still override size, color, fill, or strokeWidth when a
 * state has a specific semantic requirement.
 */
function createMoguIcon(IconComponent: LucideIcon, name: string): LucideIcon {
  const Component = ({
    color = moguBrand.color.ink,
    size = 24,
    strokeWidth = moguBrand.icon.strokeWidth,
    ...props
  }: LucideProps) => (
      <IconComponent
        color={color}
        size={size}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
      />
  );
  Component.displayName = `Mogu${name}`;
  return Component as unknown as LucideIcon;
}

const icon = <T extends LucideIcon>(value: T, name: string) => createMoguIcon(value, name);

export const Home = MoguHomeIcon;
export const Compass = MoguExploreIcon;
export const Sparkles = MoguRandomIcon;
export const HeartPulse = MoguHealthIcon;
export const UserRound = MoguProfileIcon;

export const AlertOctagon = icon(Lucide.AlertOctagon, 'AlertOctagon');
export const AlertTriangle = icon(Lucide.AlertTriangle, 'AlertTriangle');
export const Apple = icon(Lucide.Apple, 'Apple');
export const ArrowLeft = icon(Lucide.ArrowLeft, 'ArrowLeft');
export const ArrowRight = icon(Lucide.ArrowRight, 'ArrowRight');
export const Award = icon(Lucide.Award, 'Award');
export const Ban = icon(Lucide.Ban, 'Ban');
export const Beef = icon(Lucide.Beef, 'Beef');
export const CloudOff = icon(Lucide.CloudOff, 'CloudOff');
export const Droplet = icon(Lucide.Droplet, 'Droplet');
export const FileText = icon(Lucide.FileText, 'FileText');
export const LoaderCircle = icon(Lucide.LoaderCircle, 'LoaderCircle');
export const Wheat = icon(Lucide.Wheat, 'Wheat');
export const LockOpen = icon(Lucide.LockOpen, 'LockOpen');
export const Mic = icon(Lucide.Mic, 'Mic');
export const MicOff = icon(Lucide.MicOff, 'MicOff');
export const VolumeX = icon(Lucide.VolumeX, 'VolumeX');
export const Square = icon(Lucide.Square, 'Square');
export const Timer = icon(Lucide.Timer, 'Timer');
export const BarChart2 = icon(Lucide.BarChart2, 'BarChart2');
export const BarChart3 = icon(Lucide.BarChart3, 'BarChart3');
export const Bell = icon(Lucide.Bell, 'Bell');
export const BookOpen = icon(Lucide.BookOpen, 'BookOpen');
export const Bookmark = icon(Lucide.Bookmark, 'Bookmark');
export const Calendar = icon(Lucide.Calendar, 'Calendar');
export const CalendarDays = icon(Lucide.CalendarDays, 'CalendarDays');
export const Camera = icon(Lucide.Camera, 'Camera');
export const Check = icon(Lucide.Check, 'Check');
export const CheckCheck = icon(Lucide.CheckCheck, 'CheckCheck');
export const ChefHat = icon(Lucide.ChefHat, 'ChefHat');
export const ChevronDown = icon(Lucide.ChevronDown, 'ChevronDown');
export const ChevronDownIcon = ChevronDown;
export const ChevronLeft = icon(Lucide.ChevronLeft, 'ChevronLeft');
export const ChevronRight = icon(Lucide.ChevronRight, 'ChevronRight');
export const ChevronUp = icon(Lucide.ChevronUp, 'ChevronUp');
export const ChevronUpIcon = ChevronUp;
export const Clock3 = icon(Lucide.Clock3, 'Clock3');
export const Cloud = icon(Lucide.Cloud, 'Cloud');
export const CloudFog = icon(Lucide.CloudFog, 'CloudFog');
export const CloudLightning = icon(Lucide.CloudLightning, 'CloudLightning');
export const CloudRain = icon(Lucide.CloudRain, 'CloudRain');
export const Coffee = icon(Lucide.Coffee, 'Coffee');
export const Coins = icon(Lucide.Coins, 'Coins');
export const CookingPot = icon(Lucide.CookingPot, 'CookingPot');
export const Copy = icon(Lucide.Copy, 'Copy');
export const Crosshair = icon(Lucide.Crosshair, 'Crosshair');
export const Droplets = icon(Lucide.Droplets, 'Droplets');
export const Dumbbell = icon(Lucide.Dumbbell, 'Dumbbell');
export const Edit3 = icon(Lucide.Edit3, 'Edit3');
export const EyeOff = icon(Lucide.EyeOff, 'EyeOff');
export const Eye = icon(Lucide.Eye, 'Eye');
export const FileImage = icon(Lucide.FileImage, 'FileImage');
export const Flame = icon(Lucide.Flame, 'Flame');
export const Footprints = icon(Lucide.Footprints, 'Footprints');
export const Gift = icon(Lucide.Gift, 'Gift');
export const Globe = icon(Lucide.Globe, 'Globe');
export const Globe2 = icon(Lucide.Globe2, 'Globe2');
export const Heart = icon(Lucide.Heart, 'Heart');
export const HelpCircle = icon(Lucide.HelpCircle, 'HelpCircle');
export const History = icon(Lucide.History, 'History');
export const Image = icon(Lucide.Image, 'Image');
export const ImagePlus = icon(Lucide.ImagePlus, 'ImagePlus');
export const Images = icon(Lucide.Images, 'Images');
export const Info = icon(Lucide.Info, 'Info');
export const Leaf = icon(Lucide.Leaf, 'Leaf');
export const Link2 = icon(Lucide.Link2, 'Link2');
export const List = icon(Lucide.List, 'List');
export const Lock = icon(Lucide.Lock, 'Lock');
export const LockKeyhole = icon(Lucide.LockKeyhole, 'LockKeyhole');
export const MapPin = icon(Lucide.MapPin, 'MapPin');
export const Megaphone = icon(Lucide.Megaphone, 'Megaphone');
export const MessageCircle = icon(Lucide.MessageCircle, 'MessageCircle');
export const MessageSquare = icon(Lucide.MessageSquare, 'MessageSquare');
export const MessageSquareOff = icon(Lucide.MessageSquareOff, 'MessageSquareOff');
export const Minus = icon(Lucide.Minus, 'Minus');
export const Moon = icon(Lucide.Moon, 'Moon');
export const MoreHorizontal = icon(Lucide.MoreHorizontal, 'MoreHorizontal');
export const MoreVertical = icon(Lucide.MoreVertical, 'MoreVertical');
export const Navigation = icon(Lucide.Navigation, 'Navigation');
export const NotebookTabs = icon(Lucide.NotebookTabs, 'NotebookTabs');
export const Pencil = icon(Lucide.Pencil, 'Pencil');
export const Plus = icon(Lucide.Plus, 'Plus');
export const RefreshCw = icon(Lucide.RefreshCw, 'RefreshCw');
export const Repeat = icon(Lucide.Repeat, 'Repeat');
export const RotateCcw = icon(Lucide.RotateCcw, 'RotateCcw');
export const Salad = icon(Lucide.Salad, 'Salad');
export const Scale = icon(Lucide.Scale, 'Scale');
export const Search = icon(Lucide.Search, 'Search');
export const Send = icon(Lucide.Send, 'Send');
export const Settings = icon(Lucide.Settings, 'Settings');
export const Settings2 = icon(Lucide.Settings2, 'Settings2');
export const Share = icon(Lucide.Share, 'Share');
export const Share2 = icon(Lucide.Share2, 'Share2');
export const ShieldCheck = icon(Lucide.ShieldCheck, 'ShieldCheck');
export const ShieldPlus = icon(Lucide.ShieldPlus, 'ShieldPlus');
export const ShoppingCart = icon(Lucide.ShoppingCart, 'ShoppingCart');
export const SlidersHorizontal = icon(Lucide.SlidersHorizontal, 'SlidersHorizontal');
export const Soup = icon(Lucide.Soup, 'Soup');
export const SquarePen = icon(Lucide.SquarePen, 'SquarePen');
export const Star = icon(Lucide.Star, 'Star');
export const Sun = icon(Lucide.Sun, 'Sun');
export const Sunrise = icon(Lucide.Sunrise, 'Sunrise');
export const Tag = icon(Lucide.Tag, 'Tag');
export const Target = icon(Lucide.Target, 'Target');
export const Trash2 = icon(Lucide.Trash2, 'Trash2');
export const TrendingDown = icon(Lucide.TrendingDown, 'TrendingDown');
export const TrendingUp = icon(Lucide.TrendingUp, 'TrendingUp');
export const TriangleAlert = icon(Lucide.TriangleAlert, 'TriangleAlert');
export const Trophy = icon(Lucide.Trophy, 'Trophy');
export const User = icon(Lucide.User, 'User');
export const UserPlus = icon(Lucide.UserPlus, 'UserPlus');
export const Users = icon(Lucide.Users, 'Users');
export const UserX = icon(Lucide.UserX, 'UserX');
export const Utensils = icon(Lucide.Utensils, 'Utensils');
export const UtensilsCrossed = icon(Lucide.UtensilsCrossed, 'UtensilsCrossed');
export const Volume2 = icon(Lucide.Volume2, 'Volume2');
export const Wallet = icon(Lucide.Wallet, 'Wallet');
export const X = icon(Lucide.X, 'X');
export const Zap = icon(Lucide.Zap, 'Zap');
