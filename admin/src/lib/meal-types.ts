const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Mã legacy trong UI cũ → code taxonomy trên server. */
export const LEGACY_MEAL_KEY_TO_CODE: Record<string, string> = {
  sang: 'BREAKFAST',
  trua: 'LUNCH',
  toi: 'DINNER',
  phu: 'SNACK',
}

export const MEAL_SLOT_CODES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const

export type MealTypeOption = { id: string; name: string; code?: string }

export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

/** Chuyển id legacy/code sang UUID meal type từ taxonomy. */
export function migrateMealTypeIds(
  ids: string[],
  mealTypes: MealTypeOption[],
): string[] {
  const byCode = new Map(
    mealTypes
      .filter((m) => m.code)
      .map((m) => [m.code!.toUpperCase(), m.id]),
  )

  const resolved = ids
    .map((id) => {
      if (isUuid(id)) return id
      const legacy = LEGACY_MEAL_KEY_TO_CODE[id.toLowerCase()]
      const code = (legacy ?? id).toUpperCase()
      return byCode.get(code)
    })
    .filter((id): id is string => !!id)

  return [...new Set(resolved)]
}

export function mealTypesForBasicSlots(mealTypes: MealTypeOption[]): MealTypeOption[] {
  const list = mealTypes ?? []
  return MEAL_SLOT_CODES.map((code) => list.find((m) => m.code?.toUpperCase() === code)).filter(
    (m): m is MealTypeOption => !!m,
  )
}
