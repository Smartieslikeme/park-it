import { createClient } from '@blinkdotnew/sdk'

export const blink = createClient({
  projectId: import.meta.env.VITE_BLINK_PROJECT_ID || 'park-it-platform-f1lm8h68',
  publishableKey: import.meta.env.VITE_BLINK_PUBLISHABLE_KEY || 'blnk_pk_AD999dzXU5DJepzW66fnaTSuxKSJv75j',
  authRequired: false,
  auth: { mode: 'managed' },
})
