"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Checkbox } from "@/components/ui/Checkbox"
import Link from "next/link"
import { useRouter } from "next/navigation"

const loginSchema = z.object({
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  rememberMe: z.boolean().optional(),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      rememberMe: false,
    }
  })

  const onSubmit = async (data: LoginForm) => {
    setLoading(true)
    setError(null)

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (signInError) {
        console.error('Login error:', signInError)
        setError(signInError.message === 'Invalid login credentials' 
          ? "Credenciales inválidas. Por favor intente de nuevo."
          : `Error: ${signInError.message}`)
        return
      }

      router.push("/operacion/kanban")
      router.refresh()
    } catch {
      setError("Error de conexión. Por favor intente de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full flex flex-col items-center animate-in fade-in duration-500">
      {/* Branding Logo */}
      <div className="mb-12 flex flex-col items-center">
        <div className="flex items-center gap-1 text-2xl tracking-tighter font-black text-primary">
          <span>CEDI</span>
          <span className="font-light opacity-80 italic">KINETIC</span>
        </div>
        <div className="w-8 h-1 bg-primary mt-1 rounded-full" />
      </div>

      {/* Login Card */}
      <div className="w-full max-w-[540px] bg-white rounded-[40px] shadow-float p-12 lg:p-16 border border-outline-variant/10">
        <div className="text-center space-y-3 mb-12">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/60">
            Acceso de Personal
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-on-surface">
            Bienvenido de nuevo
          </h1>
          <p className="text-sm text-on-surface-variant/70 max-w-[320px] mx-auto leading-relaxed">
            Ingrese sus credenciales para acceder al panel de control central.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {error && (
            <div className="p-4 bg-error-container/10 border border-error/20 text-error rounded-2xl flex items-center gap-3 animate-in shake duration-300">
              <span className="material-symbols-outlined text-[20px]">report</span>
              <p className="text-xs font-bold uppercase tracking-wider">{error}</p>
            </div>
          )}

          <div className="space-y-6">
            <Input
              label="Email / Usuario"
              placeholder="nombre.apellido@cedikinetic.com"
              icon="person"
              error={errors.email?.message}
              {...register("email")}
            />

            <div className="space-y-2">
              <div className="flex justify-between items-end px-1 mb-1">
                <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/70">
                  Contraseña
                </label>
                <Link 
                  href="/recuperar" 
                  className="text-[11px] font-bold text-primary hover:underline underline-offset-4 transition-all"
                >
                  ¿Olvidó su contraseña?
                </Link>
              </div>
              
              <div className="relative group/pass">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  icon="lock"
                  error={errors.password?.message}
                  className="pr-12"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/30 hover:text-primary transition-colors focus:outline-none z-10"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            <Checkbox 
              label="Recordar mi sesión en este equipo"
              {...register("rememberMe")}
            />
          </div>

          <Button 
            type="submit" 
            variant="primary" 
            size="lg" 
            className="w-full rounded-2xl h-14 text-sm font-bold tracking-widest" 
            isLoading={loading}
          >
            <span className="flex items-center gap-2">
              INICIAR SESIÓN
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </span>
          </Button>
        </form>

        <div className="mt-12 pt-10 border-t border-dashed border-outline-variant/30 flex flex-col items-center gap-6">
          <p className="text-[11px] font-bold text-on-surface-variant/60 uppercase tracking-widest">
            ¿Es nuevo en el sistema?
          </p>
          <Button 
            variant="outline" 
            size="lg" 
            className="w-full rounded-2xl h-14 text-xs font-bold tracking-widest uppercase"
            asChild
          >
            <Link href="/registro">
              Crear una cuenta
            </Link>
          </Button>
        </div>
      </div>

      {/* Global Footer */}
      <div className="mt-12 w-full max-w-[540px] flex justify-between items-center px-4">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-tertiary-container animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40">
            Sistemas Operativos
          </span>
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40">
          V2.4.0-Kinetic
        </span>
      </div>
    </div>
  )
}
