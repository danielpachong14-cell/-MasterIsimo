/**
 * roles permitidos en el sistema.
 * SuperAdmin: Acceso total a configuración y administración.
 * Coordinador: Acceso operativo y visualización de datos.
 */
export type Role = 'SuperAdmin' | 'Coordinador' | string;

/**
 * Representa un enlace individual en el menú lateral.
 * @property roles - Lista de roles que tienen permiso para visualizar y acceder a este enlace.
 */
export interface MenuItem {
  label: string;
  href: string;
  icon: string;
  roles: Role[];
}

/**
 * Agrupación lógica de enlaces en el menú (Acordeón).
 */
export interface MenuGroup {
  id: string; // Identificador único para gestionar el estado de apertura (Zustand)
  label: string;
  icon: string;
  items: MenuItem[];
}

/**
 * Configuración maestra del menú lateral.
 * Define la jerarquía, iconos y permisos de toda la navegación administrativa.
 */
export const MENU_CONFIG: MenuGroup[] = [
  {
    id: 'planeacion',
    label: 'Planeación',
    icon: 'calendar_month',
    items: [
      { label: 'Configuración CEDI', icon: 'settings', href: '/admin/configuracion', roles: ['SuperAdmin'] },
    ]
  },
  {
    id: 'operacion',
    label: 'Operación Logística',
    icon: 'local_shipping',
    items: [
      { label: 'Resumen Diario', icon: 'monitoring', href: '/operacion/resumen', roles: ['SuperAdmin', 'Coordinador'] },
      { label: 'Tablero Kanban', icon: 'view_kanban', href: '/operacion/kanban', roles: ['SuperAdmin', 'Coordinador'] },
      { label: 'Trazabilidad', icon: 'list_alt', href: '/operacion/trazabilidad', roles: ['SuperAdmin', 'Coordinador'] },
      { label: 'Muelles (Timeline)', icon: 'view_timeline', href: '/operacion/muelles', roles: ['SuperAdmin', 'Coordinador'] },
    ]
  }
];

/**
 * Valida si un rol específico tiene permiso para acceder a una ruta determinada.
 * Esta función es consumida por el Middleware para proteger las rutas a nivel de servidor.
 * 
 * @param pathname - La ruta actual que se intenta acceder.
 * @param userRole - El rol del usuario obtenido desde la sesión/perfil.
 * @returns true si la ruta está permitida o no está registrada en el mapeo de protección.
 */
export function isRouteAllowed(pathname: string, userRole: string | null): boolean {
  for (const group of MENU_CONFIG) {
    for (const item of group.items) {
      if (pathname.startsWith(item.href)) {
        if (!userRole) return false;
        return item.roles.includes(userRole);
      }
    }
  }
  // Si la ruta no está definida en la configuración del menú, se asume que no tiene restricción por rol específica aquí.
  return true; 
}

