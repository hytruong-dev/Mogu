/**
 * BottomSheet — alias tương thích, dùng Drawer (react-native-reusables pattern).
 * Ưu tiên import trực tiếp từ `./drawer`.
 */
export {
  Drawer as BottomSheet,
  DrawerHeader as BottomSheetHeader,
  DrawerContent as BottomSheetContent,
  DrawerFooter as BottomSheetFooter,
  DrawerTitle as BottomSheetTitle,
  DrawerDescription as BottomSheetDescription,
  DrawerClose as BottomSheetClose,
} from './drawer';
export type { DrawerProps as BottomSheetProps } from './drawer';
