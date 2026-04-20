import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Actualiza la sesión del usuario y gestiona el control de acceso basado en roles (RBAC).
 * Este middleware se encarga de:
 * 1. Refrescar el token de sesión de Supabase.
 * 2. Identificar al usuario y proteger rutas.
 * 3. Gestionar redirecciones sincronizando cookies para evitar pérdida de sesión.
 */
export async function updateSession(request: NextRequest) {
  // Respuesta base por defecto
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Middleware: Variables de entorno de Supabase no configuradas.');
      return response;
    }

    const supabase = createServerClient(
      supabaseUrl,
      supabaseKey,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            request.cookies.set({
              name,
              value,
              ...options,
            })
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            })
            response.cookies.set({
              name,
              value,
              ...options,
            })
          },
          remove(name: string, options: CookieOptions) {
            request.cookies.set({
              name,
              value: '',
              ...options,
            })
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            })
            response.cookies.set({
              name,
              value: '',
              ...options,
            })
          },
        },
      }
    )

    // ─────────────────────────────────────────────────────────────────────────
    // 2. OBTENER / REFRESCAR USUARIO
    // ─────────────────────────────────────────────────────────────────────────
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // ─────────────────────────────────────────────────────────────────────────
    // 3. REGLAS DE ACCESO (PROTECCIÓN DE RUTAS)
    // ─────────────────────────────────────────────────────────────────────────
    const isAuthRoute = request.nextUrl.pathname.startsWith('/login')
    const isPublicRoute = 
      request.nextUrl.pathname.startsWith('/p/') || 
      request.nextUrl.pathname.startsWith('/proveedores')
    const isNextInternal = request.nextUrl.pathname.startsWith('/_next') || request.nextUrl.pathname.includes('.')

    // Ignorar archivos estáticos y rutas internas de Next
    if (isNextInternal) return response

    // Caso A: No hay usuario y la ruta es privada
    if (!user && !isAuthRoute && !isPublicRoute && request.nextUrl.pathname !== '/') {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      const redirectResponse = NextResponse.redirect(url)
      
      // Sincronizar cookies de Supabase al objeto de redirección
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value)
      })
      
      return redirectResponse
    }

    // Caso B: Hay usuario e intenta ir a login o raíz (si no tiene dashboard raíz)
    if (user && isAuthRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/operacion/kanban'
      const redirectResponse = NextResponse.redirect(url)
      
      // Sincronizar cookies
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value)
      })
      
      return redirectResponse
    }

    return response
  } catch (e) {
    console.error('Middleware Error:', e)
    return response
  }
}
