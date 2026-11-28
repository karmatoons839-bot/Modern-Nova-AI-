import React from 'react'
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  name?: string
  planName?: string
  credits?: number
  amountInr?: number
  orderId?: string
  method?: string
}

const inr = (n?: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`

const Email = ({ name, planName, credits, amountInr, orderId, method }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`${planName ?? 'Plan'} activated — ${(credits ?? 0).toLocaleString('en-IN')} credits added to your wallet`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>Modern Nova AI</Text>
        <Heading style={heading}>Payment received{name ? `, ${name}` : ''}</Heading>
        <Text style={text}>
          Your {planName ?? 'plan'} is now active and the credits are already in your wallet. Thank you!
        </Text>
        <Section style={box}>
          <Text style={row}><strong>Plan:</strong> {planName ?? '—'}</Text>
          <Text style={row}><strong>Credits added:</strong> {(credits ?? 0).toLocaleString('en-IN')}</Text>
          <Text style={row}><strong>Amount:</strong> {amountInr ? inr(amountInr) : 'Free (coupon)'}</Text>
          <Text style={row}><strong>Order:</strong> {orderId ?? '—'}</Text>
          <Text style={rowLast}><strong>Method:</strong> {method ?? '—'}</Text>
        </Section>
        <Button style={button} href="https://modernnova.in/credits">
          View your wallet
        </Button>
        <Hr style={hr} />
        <Text style={muted}>
          This is your receipt for the order above. If you did not make this payment, reply to this email
          or contact support from the website.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Payment receipt · ${d['planName'] ?? 'Plan'} · Order ${d['orderId'] ?? ''}`,
  displayName: 'Payment receipt',
  previewData: { name: 'Aarav', planName: 'Standard', credits: 100000, amountInr: 499, orderId: 'MN-ABC123', method: 'UPI' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { padding: '24px 25px', maxWidth: '560px' }
const brand = { color: '#6449da', fontSize: '14px', fontWeight: 700 as const, letterSpacing: '0.5px', textTransform: 'uppercase' as const }
const heading = { color: '#17133a', fontSize: '24px', margin: '12px 0' }
const text = { color: '#3c3854', fontSize: '15px', lineHeight: '24px' }
const box = { backgroundColor: '#f6f4fd', borderRadius: '10px', padding: '4px 16px', margin: '16px 0' }
const row = { color: '#3c3854', fontSize: '14px', lineHeight: '20px', margin: '10px 0' }
const rowLast = { ...row, marginBottom: '14px' }
const button = {
  backgroundColor: '#6449da',
  borderRadius: '10px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '15px',
  fontWeight: 600 as const,
  marginTop: '8px',
  padding: '12px 24px',
  textDecoration: 'none',
}
const hr = { borderColor: '#e6e2f7', margin: '24px 0' }
const muted = { color: '#8a86a3', fontSize: '12px', lineHeight: '18px' }
