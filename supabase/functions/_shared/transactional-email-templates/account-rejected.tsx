import * as React from 'npm:react@18.3.1'
/// <reference types="npm:@types/react@18.3.1" />
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'TimeArch'

interface AccountRejectedProps {
  name?: string
}

const AccountRejectedEmail = ({ name }: AccountRejectedProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Update on your {SITE_NAME} account request</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Text style={logoText}>⚡ {SITE_NAME}</Text>
        </Section>
        <Hr style={divider} />
        <Heading style={h1}>
          {name ? `Hi ${name},` : 'Hello,'}
        </Heading>
        <Text style={text}>
          Thank you for your interest in <strong>{SITE_NAME}</strong>. After reviewing your registration request,
          we're unable to approve your account at this time.
        </Text>
        <Text style={text}>
          This may be due to incomplete information or the current stage of our beta program.
          If you believe this is an error or would like to provide additional context, please
          reply to this email.
        </Text>
        <Hr style={divider} />
        <Text style={footer}>
          We appreciate your understanding.
        </Text>
        <Text style={footerSmall}>
          © {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AccountRejectedEmail,
  subject: `Update on your ${SITE_NAME} account request`,
  displayName: 'Account rejected notification',
  previewData: { name: 'Jane' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Space Grotesk', Arial, sans-serif" }
const container = { padding: '40px 24px', maxWidth: '560px', margin: '0 auto' }
const logoSection = { textAlign: 'center' as const, marginBottom: '8px' }
const logoText = { fontSize: '20px', fontWeight: '700', color: '#1e3a5f', margin: '0' }
const divider = { borderColor: '#e5e7eb', margin: '20px 0' }
const h1 = { fontSize: '24px', fontWeight: '700', color: '#1c2b3a', margin: '0 0 16px', lineHeight: '1.3' }
const text = { fontSize: '15px', color: '#4b5563', lineHeight: '1.6', margin: '0 0 16px' }
const footer = { fontSize: '13px', color: '#6b7280', lineHeight: '1.5', margin: '0 0 8px' }
const footerSmall = { fontSize: '11px', color: '#9ca3af', margin: '0' }
