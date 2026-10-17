# StackPiggy authentication email settings

Auth emails are sent by Supabase through Resend custom SMTP, from
`StackPiggy <hello@stackpiggy.com>`. The React app cannot override sender,
subject or body; they live in the Supabase dashboard.

## SMTP (Authentication > Emails > SMTP Settings)

- Sender email: `hello@stackpiggy.com`
- Sender name: `StackPiggy`
- Host: `smtp.resend.com`, port `465`, username `resend`
- Password: a Resend API key with sending access to stackpiggy.com (never commit it)
- Minimum interval per user: 60 seconds

DNS (Cloudflare): Resend DKIM at `resend._domainkey`, return path at
`send.stackpiggy.com`, Cloudflare Email Routing MX on the root for `hello@`,
DMARC at `_dmarc`.

## Templates (Authentication > Emails > Templates)

Copy each body from `supabase/templates/` and set the subject:

| Template | File | Subject |
|---|---|---|
| Confirm signup | `confirmation.html` | Confirm your StackPiggy email |
| Reset password | `recovery.html` | Reset your StackPiggy password |
| Magic link | `magic_link.html` | Your StackPiggy sign-in link |
| Change email address | `email_change.html` | Confirm your new StackPiggy email |
| Reauthentication | `reauthentication.html` | Your StackPiggy security code |
| Security: Password changed | `password_changed.html` | Your StackPiggy password was changed |
| Security: Email address changed | `email_changed.html` | Your StackPiggy email was changed |

Templates use only `{{ .ConfirmationURL }}` (and `{{ .Token }}` for
reauthentication). Do not print hash or user variables in the message body.

After changing a template, sign up or reset with a disposable inbox and check the
sender, subject, branding and that the link lands back in the app.
