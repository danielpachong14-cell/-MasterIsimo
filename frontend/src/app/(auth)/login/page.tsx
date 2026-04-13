"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Card, CardContent } from "@/components/ui/Card"
import Link from "next/link"
import { useRouter } from "next/navigation"

const loginSchema = z.object({
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
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
    } catch (err: any) {
      if (!error) {
        setError("Error de conexión. Por favor intente de nuevo.")
      }
    } finally {
      setLoading(false)
    }
  }



  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-20">
      <div className="w-full max-w-md space-y-12">
        <div className="lg:hidden space-y-4 text-center">
          <h1 className="text-5xl font-black font-headline text-primary tracking-tighter">
            MasterIsimo
          </h1>
          <p className="text-sm font-bold uppercase tracking-widest text-on-surface-variant/60">
            Logística Inteligente
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-4xl font-black font-headline text-on-surface tracking-tight">
            Bienvenido
          </h2>
          <p className="text-on-surface-variant">
            Ingrese sus credenciales para acceder al panel de control.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {error && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
              <div className="p-4 bg-error-container text-on-error-container rounded-xl flex items-center gap-3">
                <span className="material-symbols-outlined">report</span>
                <p className="text-sm font-medium">{error}</p>
              </div>
              

            </div>
          )}

          <div className="space-y-6">
            <Input
              label="Correo Electrónico"
              placeholder="usuario@isimo.com"
              icon="alternate_email"
              error={errors.email?.message}
              {...register("email")}
            />
            <div className="space-y-1">
              <Input
                label="Contraseña"
                type="password"
                placeholder="••••••••"
                icon="lock"
                error={errors.password?.message}
                {...register("password")}
              />
              <div className="flex justify-end px-1">
                <Link 
                  href="/recuperar" 
                  className="text-xs font-bold text-primary hover:text-primary-container transition-colors"
                >
                  ¿OLVIDÓ SU CONTRASEÑA?
                </Link>
              </div>
            </div>
          </div>

          <Button type="submit" variant="primary" size="lg" className="w-full shadow-elevated" isLoading={loading}>
            INICIAR SESIÓN
          </Button>
        </form>

        <div className="pt-8 border-t border-surface-container-highest">
          <p className="text-sm text-center text-on-surface-variant">
            ¿No tiene una cuenta?{" "}
            <Link 
              href="/registro" 
              className="font-bold text-primary hover:text-primary-container transition-colors"
            >
              SOLICITAR ACCESO
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
