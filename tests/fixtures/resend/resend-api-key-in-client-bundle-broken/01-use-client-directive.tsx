'use client';

import { Resend } from 'resend';
import { useState } from 'react';

// Client component that instantiates Resend — key would ship to the browser.
const resend = new Resend(process.env.NEXT_PUBLIC_RESEND_KEY);

export default function SignupForm() {
  const [email, setEmail] = useState('');

  async function onSubmit() {
    await resend.emails.send({
      from: 'Acme <onboarding@acme.com>',
      to: [email],
      subject: 'Welcome',
      html: '<p>Welcome</p>',
    });
  }

  return <button onClick={onSubmit}>Sign up</button>;
}
