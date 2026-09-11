import { createContext, useContext, useRef, useCallback, type ReactNode } from 'react'

type CreateHandler = () => void

interface FoodDataActionsContextValue {
  registerCreateHandler: (handler: CreateHandler | null) => void
  triggerCreate: () => void
}

const FoodDataActionsContext = createContext<FoodDataActionsContextValue | null>(null)

export function FoodDataActionsProvider({ children }: { children: ReactNode }) {
  const handlerRef = useRef<CreateHandler | null>(null)

  const registerCreateHandler = useCallback((handler: CreateHandler | null) => {
    handlerRef.current = handler
  }, [])

  const triggerCreate = useCallback(() => {
    handlerRef.current?.()
  }, [])

  return (
    <FoodDataActionsContext.Provider value={{ registerCreateHandler, triggerCreate }}>
      {children}
    </FoodDataActionsContext.Provider>
  )
}

export function useFoodDataActions() {
  const ctx = useContext(FoodDataActionsContext)
  if (!ctx) {
    return {
      registerCreateHandler: (_handler: CreateHandler | null) => {},
      triggerCreate: () => {},
    }
  }
  return ctx
}
