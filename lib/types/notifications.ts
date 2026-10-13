export type NotificationType = 'info' | 'success' | 'warning' | 'alert'

export interface AppNotification {
  id: string
  title: string
  message: string
  time: string | Date
  type: NotificationType
  read?: boolean
  linkView?: string
  linkData?: any
}

export interface SearchItem {
  id: string
  title: string
  subtitle: string
  category: string
  badge?: string
  badgeColor?: 'emerald' | 'blue' | 'amber' | 'rose' | 'slate'
  onSelect: () => void
}
