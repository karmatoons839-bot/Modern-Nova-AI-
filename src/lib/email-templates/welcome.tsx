import React from 'react'
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  name?: string
}

const Email = ({ name }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Modern Nova AI account is ready — 5,000 free credits included</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>Modern Nova AI</Text>
        <Heading style={heading}>Welcome{name ? `, ${name}` : ''}!</Heading>
        <Text style={text}>
          Your account is ready and 5,000 free credits are already in your wallet. Try Hindi voiceovers,
          story scripts, images, thumbnails and script-to-video — all from one dashboard.
        </Text>
        <Button style={button} href="https://modernnova.in/tools">
          Explore the tools
        </Button>
        <Hr style={hr} />
        <Text style={muted}>
          You received this email because a Modern Nova AI account was just created with this address.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Welcome to Modern Nova AI — your 5,000 free credits are ready',
  displayName: 'Welcome (new account)',
  previewData: { name: 'Aarav' },
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
