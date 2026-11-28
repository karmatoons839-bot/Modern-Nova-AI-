import type { ComponentType } from 'react'
import { template as welcome } from './welcome'
import { template as paymentReceipt } from './payment-receipt'
import { template as generationReady } from './generation-ready'
import { template as supportTicket } from './support-ticket'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'welcome': welcome,
  'payment-receipt': paymentReceipt,
  'generation-ready': generationReady,
  'support-ticket': supportTicket,
}
