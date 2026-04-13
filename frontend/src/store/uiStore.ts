import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Definición del estado global para componentes de interfaz.
 * @property openAccordionIds - Lista de identificadores de secciones del menú que están expandidas.
 * @property isSidebarCollapsed - Determina si la barra lateral se encuentra en modo icono (compacta).
 */
interface UIState {
  openAccordionIds: string[];
  setOpenAccordionIds: (ids: string[]) => void;
  toggleAccordion: (id: string) => void;
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

/**
 * Store de Zustand para la gestión de estados persistentes de la UI.
 * Utiliza 'localStorage' bajo la llave 'sidebar-ui-storage' para recordar la preferencia del usuario
 * sobre el colapso del menú y las secciones abiertas.
 */
export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      // Configuración inicial: sección 'operacion' abierta por defecto.
      openAccordionIds: ['operacion'], 
      isSidebarCollapsed: false,
      
      setOpenAccordionIds: (ids) => set({ openAccordionIds: ids }),
      
      /**
       * Alterna el estado de una sección (acordeón) del menú.
       * Si el Sidebar está colapsado, lo expande automáticamente para mostrar el contenido del acordeón.
       */
      toggleAccordion: (id) => {
        const current = get().openAccordionIds;
        const currentCollapsed = get().isSidebarCollapsed;
        
        if (currentCollapsed) {
          set({ isSidebarCollapsed: false });
        }

        if (current.includes(id)) {
          set({ openAccordionIds: current.filter((i) => i !== id) });
        } else {
          set({ openAccordionIds: [...current, id] });
        }
      },
      
      /**
       * Alterna entre el estado expandido (300px) y colapsado (90px) del Sidebar.
       */
      toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
    }),
    {
      name: 'sidebar-ui-storage', 
    }
  )
);

