import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Actualiza la sesión del usuario y gestiona el control de acceso basado en roles (RBAC).
 * Este middleware se encarga de:
 * 1. Refrescar el token de sesión de Supabase.
 * 2. Identificar al usuario y su rol desde el perfil.
 * 3. Proteger rutas privadas y redirigir según permisos.
 * 
 * @param request - El objeto de la petición Next.js.
 * @returns Una respuesta de redirección o la continuación de la petición.
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

    // Validación crítica de entorno para evitar pánico en Edge Runtime
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

    let user = null
    let userRole: string | null = null
    
    // Obtener información del usuario con manejo seguro de excepciones
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
      // Si hay error de sesión, simplemente tratamos al usuario como no autenticado
      user = null;
    } else {
      user = authUser;
    }
    
    if (user) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role_id')
        .eq('id', user.id)
        .single()
        
      if (profile) {
        userRole = profile.role_id === 1 ? 'SuperAdmin' : 
                   profile.role_id === 2 ? 'Coordinador' : null
      }
    }

    const publicRoutes = ['/proveedores', '/login', '/registro', '/p']
    const pathname = request.nextUrl.pathname;
    const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

    // Lógica de redirección segura
    if (!user && !isPublicRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    const isNextInternal = pathname.startsWith('/_next') || pathname.includes('.')
    const isRootPath = pathname === '/'
    
    if (user && !isPublicRoute && !isNextInternal && !isRootPath) {
      // Importación dinámica segura
      const menuModule = await import('@/config/menu');
      const isAllowed = menuModule.isRouteAllowed(pathname, userRole);
      
      if (!isAllowed) {
        const url = request.nextUrl.clone()
        url.pathname = '/login' 
        return NextResponse.redirect(url)
      }
    }

  } catch (error) {
    // Si algo falla catastróficamente, permitimos que la petición continúe (Failsafe)
    // para no bloquear el acceso total al sitio.
    console.error('Middleware: Error Fatal en updateSession:', error)
  }

  return response
}


