// docs-example-source: https://resend.com/docs/webhooks/verify-webhooks-requests
// Verbatim "verify the webhook request ... using the Resend SDK" example.
// The doc snippet assumes a pre-built `resend` client and Next.js types in
// scope; the imports below are the minimal glue the doc implies.
import { NextRequest, NextResponse } from 'next/server';
import { resend } from '@/lib/resend';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.text();

    // Throws an error if the webhook is invalid
    // Otherwise, returns the parsed payload object
    const result = resend.webhooks.verify({
      payload,
      headers: {
        id: req.headers['svix-id'],
        timestamp: req.headers['svix-timestamp'],
        signature: req.headers['svix-signature'],
      },
      webhookSecret: process.env.RESEND_WEBHOOK_SECRET,
    });

    // Handle the result after validating it
  } catch {
    return new NextResponse('Invalid webhook', { status: 400 });
  }
}
