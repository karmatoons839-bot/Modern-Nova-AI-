import React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  ticketId?: string
  kind?: string
  linked?: boolean
  description?: string
}

const Email = ({ ticketId, kind, linked, description }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`New ${kind ?? 'support'} ticket ${ticketId ?? ''} from the Telegram bot`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>Modern Nova AI · Support</Text>
        <Heading style={heading}>New {kind ?? 'support'} ticket</Heading>
        <Section style={box}>
          <Text style={row}><strong>Ticket:</strong> {ticketId ?? '—'}</Text>
          <Text style={row}><strong>Type:</strong> {kind ?? 'support'}</Text>
          <Text style={rowLast}><strong>Account:</strong> {linked ? 'Linked website account (verified)' : 'Not linked'}</Text>
        </Section>
        <Text style={text}>{description ?? ''}</Text>
        <Hr style={hr} />
        <Text style={muted}>
          This ticket was filed through the Modern Nova AI Telegram bot. Full details and the reply
          controls are in the admin Telegram group.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `New ${d['kind'] ?? 'support'} ticket ${d['ticketId'] ?? ''} · Modern Nova AI`,
  displayName: 'Support ticket (bot)',
  previewData: { ticketId: 'c8c7f0e4-0000-4000-8000-000000000001', kind: 'support', linked: true, description: 'Meri voice generation fail ho gayi lekin credits kat gaye. Kripya madad karein.' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { padding: '24px 25px', maxWidth: '560px' }
const brand = { color: '#6449da', fontSize: '14px', fontWeight: 700 as const, letterSpacing: '0.5px', textTransform: 'uppercase' as const }
const heading = { color: '#17133a', fontSize: '24px', margin: '12px 0' }
const text = { color: '#3c3854', fontSize: '15px', lineHeight: '24px', whiteSpace: 'pre-wrap' as const }
const box = { backgroundColor: '#f6f4fd', borderRadius: '10px', padding: '4px 16px', margin: '16px 0' }
const row = { color: '#3c3854', fontSize: '14px', lineHeight: '20px', margin: '10px 0' }
const rowLast = { ...row, marginBottom: '14px' }
const hr = { borderColor: '#e6e2f7', margin: '24px 0' }
const muted = { color: '#8a86a3', fontSize: '12px', lineHeight: '18px' }
