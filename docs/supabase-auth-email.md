# Pocket CFO authentication email settings

The hosted Supabase project controls the sender identity, subject and recovery
email body. The React application cannot override these fields when calling
`resetPasswordForEmail`.

Apply these values in **Supabase Dashboard > Authentication > Email Templates > Reset Password**:

- Subject: `Reset your Pocket CFO password`
- Body: copy `supabase/templates/recovery.html`

The template deliberately uses only `{{ .ConfirmationURL }}`. Do not print token,
hash or user variables in the message body.

To replace **Supabase Auth <noreply@mail.app.supabase.io>**, configure custom SMTP
under **Project Settings > Authentication > SMTP Settings**:

- Sender name: `Pocket CFO`
- Sender email: an address on a domain controlled by Pocket CFO
- Host, port, username and password: values from the selected email provider

Publish SPF and DKIM records supplied by that provider before enabling the sender.
Send a password-reset message to a disposable test account and confirm the sender,
subject, Pocket CFO branding, callback, one-time use and expiry behavior.
