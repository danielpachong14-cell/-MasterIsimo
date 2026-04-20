"use client"

import { Button } from "@/components/ui/Button"

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  loading: boolean
}

/**
 * Modal genérico de confirmación de acción destructiva o crítica.
 * Renderiza un overlay centrado con botones de Cancelar / Confirmar.
 */
export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  loading,
}: ConfirmModalProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-float w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8 space-y-4">
          <div className="w-14 h-14 bg-tertiary-fixed/30 rounded-2xl flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-2xl text-tertiary">swap_horiz</span>
          </div>
          <h3 className="text-xl font-black font-headline text-center">{title}</h3>
          <p className="text-sm text-on-surface-variant text-center leading-relaxed">{message}</p>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={onConfirm} disabled={loading}>
              {loading ? "Procesando..." : "Confirmar Cambio"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
