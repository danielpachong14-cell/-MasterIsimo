import { SupplierForm } from "@/components/features/SupplierForm"

export default function ProveedoresPage() {
  return (
    <main className="min-h-screen bg-surface flex flex-col items-center py-12 px-4 selection:bg-primary-fixed selection:text-primary">
      {/* Branding Header */}
      <div className="w-full max-w-2xl mb-12 flex flex-col items-center text-center space-y-4">
        <div className="bg-primary p-3 rounded-2xl shadow-elevated mb-4 animate-in zoom-in duration-700">
          <span className="material-symbols-outlined text-white text-4xl">inventory</span>
        </div>
        <div className="space-y-1">
          <h1 className="text-4xl font-black font-headline tracking-tight text-primary">MasterIsimo</h1>
          <p className="text-on-surface-variant font-medium tracking-wide border-y border-surface-container-highest py-2">
            CONTROL DE ABASTECIMIENTO CEDI
          </p>
        </div>
        <p className="text-sm text-on-surface-variant/60 max-w-md mx-auto leading-relaxed pt-4">
          Portal exclusivo para proveedores y transportistas. Registre su arribo para garantizar un flujo de descarga eficiente y preciso.
        </p>
      </div>

      {/* Main Form */}
      <div className="w-full max-w-4xl">
        <SupplierForm />
      </div>

      {/* Footer / Support */}
      <footer className="mt-20 text-center space-y-4 text-on-surface-variant/40">
        <div className="flex items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">verified_user</span>
            <span className="text-xs font-bold uppercase tracking-widest">Protocolo Seguro</span>
          </div>
          <div className="w-1 h-1 bg-surface-container-highest rounded-full" />
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">support_agent</span>
            <span className="text-xs font-bold uppercase tracking-widest">Soporte CEDI</span>
          </div>
        </div>
        <p className="text-[10px] font-medium tracking-tighter">
          © 2026 MASTER ISIMO LOGISTICS — TODOS LOS DERECHOS RESERVADOS
        </p>
      </footer>
    </main>
  )
}
