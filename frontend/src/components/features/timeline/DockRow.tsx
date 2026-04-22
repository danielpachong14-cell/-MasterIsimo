"use client"

import { cn } from "@/lib/utils"
import { TimelineDockRow } from "@/lib/services/appointments"

interface DockRowProps {
  dock: TimelineDockRow
  index: number
  cellWidth: number
  timeHeadersCount: number
  rowHeight: number
  labelWidth: number
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent, dockId: number) => void
  children: React.ReactNode
}

export function DockRow({
  dock,
  index,
  cellWidth,
  timeHeadersCount,
  rowHeight,
  labelWidth,
  onDragOver,
  onDrop,
  children
}: DockRowProps) {
  return (
    <div 
      className={cn(
        "flex border-b border-surface-container/50 relative",
        index % 2 === 0 ? 'bg-white' : 'bg-surface-container-lowest'
      )} 
      style={{ height: rowHeight }}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, dock.id)}
    >
      {/* Dock Label */}
      <div 
        className="flex-shrink-0 flex items-center gap-2 px-4 border-r border-surface-container sticky left-0 z-10 bg-inherit" 
        style={{ width: labelWidth }}
      >
        <div className={cn(
          "w-2.5 h-2.5 rounded-full",
          dock.is_active ? 'bg-tertiary shadow-[0_0_6px_rgba(78,222,163,0.5)]' : 'bg-on-surface-variant/20'
        )} />
        <span className="text-xs font-bold text-on-surface truncate">{dock.name}</span>
      </div>

      {/* Grid Background */}
      <div className="flex relative flex-1">
        {Array.from({ length: timeHeadersCount }).map((_, i) => (
          <div 
            key={i} 
            className="flex-shrink-0 border-r border-surface-container/30" 
            style={{ width: cellWidth, height: rowHeight }} 
          />
        ))}

        {children}
      </div>
    </div>
  )
}
