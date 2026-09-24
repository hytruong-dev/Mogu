import { useCallback, useState, useEffect } from 'react';
import { Alert, Share } from 'react-native';
import { isDishSaved, toggleDishSave, subscribeSavedDishChange } from '../../services/saved-dishes-store';

export function useDishSave(dishId?: string, initialSaved = false) {
  const [isSaved, setIsSaved] = useState(dishId ? isDishSaved(dishId) || initialSaved : initialSaved);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!dishId) return;
    setIsSaved(isDishSaved(dishId) || initialSaved);
    return subscribeSavedDishChange((changedId, next) => {
      if (changedId === dishId) setIsSaved(next);
    });
  }, [dishId, initialSaved]);

  const toggleSave = useCallback(async (dishMeta?: any) => {
    if (!dishId || saving) return;
    setSaving(true);
    try {
      const next = await toggleDishSave(dishId, isSaved, dishMeta);
      setIsSaved(next);
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không lưu được món.');
    } finally {
      setSaving(false);
    }
  }, [dishId, isSaved, saving]);

  return { isSaved, saving, toggleSave };
}

export async function shareDish(dishName: string, dishId?: string) {
  try {
    await Share.share({
      message: dishId
        ? `Xem món ${dishName} trên Mogu`
        : `Món ngon: ${dishName}`,
      title: dishName,
    });
  } catch {
    // user dismissed
  }
}
