import React from 'react'
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  name?: string
  toolName?: string
  title?: string
  url?: string
}

const Email = ({ name, toolName, title, url }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`${toolName ?? 'Your creation'} is ready${title ? ` · ${title}` : ''}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>Modern Nova AI</Text>
        <Heading style={heading}>{toolName ?? 'Your creation'} is ready</Heading>
        <Text style={text}>
          Hi{name ? ` ${name}` : ''}, your {toolName ?? 'creation'}
          {title ? ` “${title}”` : ''} has finished and is saved to your account. Open it to play,
          download or share your work.
        </Text>
        <Button style={button} href={url ?? 'https://modernnova.in/history'}>
          Open my creation
        </Button>
        <Hr style={hr} />
        <Text style={muted}>
          You received this because a generation you started on Modern Nova AI just completed. You can
          turn off generation emails in Settings.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `${d['toolName'] ?? 'Your creation'} is ready${d['title'] ? ` · ${d['title']}` : ''}`,
  displayName: 'Generation ready',
  previewData: { name: 'Aarav', toolName: 'Voice Studio voiceover', title: 'The Last Wish', url: 'https://modernnova.in/history' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { padding: '24px 25px', maxWidth: '560px' }
const brand = { color: '#6449da', fontSize: '14px', fontWeight: 700 as const, letterSpacing: '0.5px', textTransform: 'uppercase' as const }
const heading = { color: '#17133a', fontSize: '24px', margin: '12px 0' }
const text = { color: '#3c3854', fontSize: '15px', lineHeight: '24px' }
const button = {
  backgroundColor: '#6449da',
  borderRadius: '10px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '15px',
  fontWeight: 600 as const,
  marginTop: '16px',
  padding: '12px 24px',
  textDecoration: 'none',
}
const hr = { borderColor: '#e6e2f7', margin: '24px 0' }
const muted = { color: '#8a86a3', fontSize: '12px', lineHeight: '18px' }
