"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/Button"

interface ScheduleSupplierModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ScheduleSupplierModal({ isOpen, onClose }: ScheduleSupplierModalProps) {
  const [isCopied, setIsCopied] = useState(false)
  const [supplierUrl, setSupplierUrl] = useState("")

  useEffect(() => {
    // Generate the URL dynamically based on current domain
    if (typeof window !== "undefined") {
      setSupplierUrl(`${window.location.origin}/proveedores`)
    }
  }, [])

  // Prevenir scroll cuando el modal está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }
    return () => {
      document.body.style.overflow = "unset"
    }
  }, [isOpen])

  // Cerrar presionando Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [onClose])

  if (!isOpen) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(supplierUrl)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy text: ", err)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop con Blur tipo Glassmorphism */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div 
        className={cn(
          "relative bg-white dark:bg-surface-elevated rounded-3xl w-full max-w-md shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-white/20 p-8",
          "animate-in fade-in zoom-in-95 duration-200"
        )}
      >
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-full p-1.5 transition-colors"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>

        <div className="flex flex-col items-center text-center space-y-4 mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-2 shadow-sm">
            <span className="material-symbols-outlined text-3xl">calendar_add_on</span>
          </div>
          <h2 className="text-2xl font-bold font-headline text-on-surface tracking-tight">Agendar Proveedor</h2>
          <p className="text-sm text-on-surface-variant max-w-[280px]">
            Comparte el siguiente enlace con el proveedor para que seleccione su fecha y andén sugerido.
          </p>
        </div>

        <div className="bg-surface-container/50 rounded-2xl p-4 mb-6 border border-white/50">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Enlace Público</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white dark:bg-surface border border-outline-variant rounded-xl px-4 py-2.5 text-sm text-on-surface truncate shadow-sm font-medium">
              {supplierUrl}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button 
            variant="secondary" 
            className="flex-1 rounded-xl h-12"
            onClick={onClose}
          >
            Cerrar
          </Button>
          <Button 
            className={cn(
              "flex-1 rounded-xl h-12 text-sm shadow-elevated hover:shadow-lg transition-all",
              isCopied ? "bg-green-600 hover:bg-green-700" : "bg-primary"
            )}
            onClick={handleCopy}
          >
            <span className="material-symbols-outlined mr-2 text-base">
              {isCopied ? "check_circle" : "content_copy"}
            </span>
            {isCopied ? "¡Enlace Copiado!" : "Copiar Enlace"}
          </Button>
        </div>
      </div>
    </div>
  )
}
