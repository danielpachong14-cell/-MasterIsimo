"use client"

import { useEffect } from "react"
import { useUserStore } from "@/store/userStore"

export function useProfile() {
  const { 
    profile, 
    sessions, 
    activities, 
    loading, 
    error,
    initialize,
    updateProfile,
    changePassword,
    fetchSessions,
    logoutOthers,
    fetchActivityLog
  } = useUserStore()

  useEffect(() => {
    let cleanup: (() => void) | undefined
    
    const setup = async () => {
      cleanup = await initialize()
    }

    setup()

    return () => {
      if (cleanup) cleanup()
    }
  }, [initialize])

  return { 
    profile, 
    sessions, 
    activities,
    loading, 
    error, 
    updateProfile, 
    changePassword, 
    fetchSessions, 
    logoutOthers,
    fetchActivityLog
  }
}
