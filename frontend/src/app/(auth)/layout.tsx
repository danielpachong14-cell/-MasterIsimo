export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[7fr,5fr]">
      {/* Visual Side */}
      <div className="hidden lg:flex relative bg-primary items-center justify-center p-20 overflow-hidden">
        {/* Kinetic Background Elements */}
        <div className="absolute top-0 right-0 w-full h-full opacity-20 pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-primary-container blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-secondary-container blur-[100px]" />
        </div>
        
        <div className="relative z-10 flex flex-col space-y-12 max-w-xl">
          <div className="space-y-4">
            <div className="w-16 h-2 bg-secondary-fixed rounded-full" />
            <h1 className="text-7xl font-black font-headline text-white leading-[0.9] tracking-tighter">
              PRECISION <br/>IN MOTION
            </h1>
          </div>
          
          <div className="space-y-6">
            <p className="text-xl text-primary-fixed/80 font-medium leading-relaxed">
              Gestione su operación logística con el estándar industrial de MasterIsimo. Inteligencia de patio en tiempo real.
            </p>
            
            <div className="grid grid-cols-2 gap-8 pt-8">
              <div className="space-y-1">
                <p className="text-4xl font-bold text-white font-headline">99.9%</p>
                <p className="text-xs font-bold uppercase tracking-widest text-secondary-fixed/50">Disponibilidad</p>
              </div>
              <div className="space-y-1">
                <p className="text-4xl font-bold text-white font-headline">实时</p>
                <p className="text-xs font-bold uppercase tracking-widest text-secondary-fixed/50">Real-Time Data</p>
              </div>
            </div>
          </div>
        </div>

        {/* Branding Watermark */}
        <div className="absolute bottom-12 left-20">
          <p className="text-xs font-black tracking-[0.3em] text-white/20 uppercase">
            Kinetic Architect v4.1
          </p>
        </div>
      </div>

      {/* Form Side */}
      <div className="flex flex-col bg-surface overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
