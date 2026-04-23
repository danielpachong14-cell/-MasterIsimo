import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Appointment } from '@/types';
import { TimelineAppointmentRow } from '@/lib/services/appointments';

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
  
  // Appointment Detail Modal State (Zustand Centralized)
  selectedAppointment: Appointment | null;
  isAppointmentModalOpen: boolean;
  isAdvancedSchedulingMode: boolean;
  openAppointmentDetails: (appointment: Appointment) => void;
  closeAppointmentDetails: () => void;
  setAdvancedSchedulingMode: (isAdvanced: boolean) => void;
  
  // Timeline/Muelles Volatile States
  timelineConfirmModal: { appointmentId: string; newDockId: number; newTime: string } | null;
  timelineEditModal: Appointment | TimelineAppointmentRow | null;
  timelineExtendModal: string | null;

  setTimelineConfirmModal: (modal: { appointmentId: string; newDockId: number; newTime: string } | null) => void;
  setTimelineEditModal: (appointment: Appointment | TimelineAppointmentRow | null) => void;
  setTimelineExtendModal: (appointmentId: string | null) => void;
  clearTimelineModals: () => void;

  // Timeline Appointment Drawer (v4.2)
  // Uses TimelineAppointmentRow (not full Appointment) to preserve Zero Over-fetching.
  // All data needed for the drawer is already available in the Gantt data payload.
  timelineDrawerAppointment: TimelineAppointmentRow | null;
  isTimelineDrawerOpen: boolean;
  openTimelineDrawer: (appointment: TimelineAppointmentRow) => void;
  closeTimelineDrawer: () => void;
  updateDrawerAppointment: (updated: Partial<TimelineAppointmentRow>) => void;
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

      // Appointment Details actions
      selectedAppointment: null,
      isAppointmentModalOpen: false,
      isAdvancedSchedulingMode: false,
      
      openAppointmentDetails: (appointment) => set({ 
        selectedAppointment: appointment, 
        isAppointmentModalOpen: true,
        isAdvancedSchedulingMode: false // Reset mode on new open
      }),
      
      closeAppointmentDetails: () => set({ 
        selectedAppointment: null, 
        isAppointmentModalOpen: false 
      }),
      
      setAdvancedSchedulingMode: (isAdvanced) => set({ 
        isAdvancedSchedulingMode: isAdvanced 
      }),

      // Timeline/Muelles Volatile States
      timelineConfirmModal: null,
      timelineEditModal: null,
      timelineExtendModal: null,

      setTimelineConfirmModal: (modal) => set({ timelineConfirmModal: modal }),
      setTimelineEditModal: (appointment) => set({ timelineEditModal: appointment }),
      setTimelineExtendModal: (appointmentId) => set({ timelineExtendModal: appointmentId }),
      clearTimelineModals: () => set({
        timelineConfirmModal: null,
        timelineEditModal: null,
        timelineExtendModal: null
      }),

      // Timeline Drawer (v4.2)
      timelineDrawerAppointment: null,
      isTimelineDrawerOpen: false,

      openTimelineDrawer: (appointment) => set({
        timelineDrawerAppointment: appointment,
        isTimelineDrawerOpen: true
      }),

      closeTimelineDrawer: () => set({
        isTimelineDrawerOpen: false,
        // Delay clearing the appointment so close animation completes smoothly
        timelineDrawerAppointment: null
      }),

      // Optimistic local update: reflects status change before Realtime propagates
      updateDrawerAppointment: (updated) => set(state => ({
        timelineDrawerAppointment: state.timelineDrawerAppointment
          ? { ...state.timelineDrawerAppointment, ...updated }
          : null
      })),
    }),
    {
      name: 'sidebar-ui-storage', 
      partialize: (state) => ({ 
        openAccordionIds: state.openAccordionIds,
        isSidebarCollapsed: state.isSidebarCollapsed,
      }),
    }
  )
);

