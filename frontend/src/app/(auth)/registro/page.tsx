"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { useRouter } from "next/navigation"
import Link from "next/link"

const registerSchema = z.object({
  fullName: z.string().min(5, "Nombre completo requerido"),
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
})

type RegisterForm = z.infer<typeof registerSchema>

export default function RegistroPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true)
    setError(null)

    try {
      // 1. Sign up user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
          }
        }
      })

      if (signUpError) throw signUpError

      if (authData.user) {
        // Note: In a production app with triggers, user_profiles is usually handled via DB trigger
        // but let's ensure it's created if not handled or for development speed
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            id: authData.user.id,
            full_name: data.fullName,
            role_id: 2, // Default to Coordinador for this demo, or restricted in prod
          })
          
        if (profileError) console.error("Profile creation error:", profileError)
      }

      setSuccess(true)
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err.message || "Error al crear la cuenta.")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-20 text-center space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="w-24 h-24 bg-tertiary-fixed rounded-full flex items-center justify-center mx-auto">
          <span className="material-symbols-outlined text-tertiary text-5xl">mark_email_read</span>
        </div>
        <div className="space-y-2">
          <h2 className="text-4xl font-black font-headline text-on-surface tracking-tight">Verifique su correo</h2>
          <p className="text-on-surface-variant max-w-sm mx-auto">
            Hemos enviado un enlace de confirmación a su cuenta. Por favor verifíquela para activar su acceso.
          </p>
        </div>
        <Button onClick={() => router.push("/login")} variant="secondary" size="lg">
          VOLVER AL INICIO
        </Button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-20">
      <div className="w-full max-w-md space-y-10">
        <div className="space-y-2">
          <h2 className="text-4xl font-black font-headline text-on-surface tracking-tight">
            Nueva Cuenta
          </h2>
          <p className="text-on-surface-variant">
            Cree su perfil de acceso operativo MasterIsimo.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {error && (
            <div className="p-4 bg-error-container text-on-error-container rounded-xl flex items-center gap-3">
              <span className="material-symbols-outlined">error</span>
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <div className="space-y-5">
            <Input
              label="Nombre Completo"
              placeholder="Juan Pérez"
              icon="badge"
              error={errors.fullName?.message}
              {...register("fullName")}
            />
            <Input
              label="Correo Institucional"
              placeholder="jperez@isimo.com"
              icon="mail"
              error={errors.email?.message}
              {...register("email")}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Contraseña"
                type="password"
                placeholder="••••••"
                icon="key"
                error={errors.password?.message}
                {...register("password")}
              />
              <Input
                label="Confirmar"
                type="password"
                placeholder="••••••"
                icon="lock_reset"
                error={errors.confirmPassword?.message}
                {...register("confirmPassword")}
              />
            </div>
          </div>

          <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={loading}>
            SOLICITAR ACCESO
          </Button>
        </form>

        <p className="text-sm text-center text-on-surface-variant">
          ¿Ya tiene una cuenta?{" "}
          <Link 
            href="/login" 
            className="font-bold text-primary hover:text-primary-container transition-colors"
          >
            INICIAR SESIÓN
          </Link>
        </p>
      </div>
    </div>
  )
}
