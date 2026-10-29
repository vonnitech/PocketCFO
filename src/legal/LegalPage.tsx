import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PRICING } from '../lib/pricing';
import { LEGAL_UPDATED, OPERATOR } from './operator';
import '../landing/landing.css';
import './legal.css';

// Public Terms, Privacy and Refunds pages. They share the landing page's look
// (landing.css, scoped under .lp) and are reachable signed in or out, because
// Paddle checks they exist and the upgrade panel links to them.
//
// Every factual claim here describes how the app actually works today (see
// docs/PRIVACY.md for the reasoning behind each). When the product changes in
// a way these pages describe, update the page and LEGAL_UPDATED together.

export type LegalDoc = 'terms' | 'privacy' | 'refunds';

const TITLES: Record<LegalDoc, string> = {
  terms: 'Terms of Use',
  privacy: 'Privacy Policy',
  refunds: 'Refund Policy',
};

const NAV_LABELS: Record<LegalDoc, string> = { terms: 'Terms', privacy: 'Privacy', refunds: 'Refunds' };

const Mail = () => <a href={`mailto:${OPERATOR.contactEmail}`}>{OPERATOR.contactEmail}</a>;

function Shell({ doc, title, lead, toc, children }: {
  doc: LegalDoc;
  title: ReactNode;
  lead: string;
  toc: [string, string][];
  children: ReactNode;
}) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${TITLES[doc]} | StackPiggy`;
    window.scrollTo(0, 0);
    return () => { document.title = previous; };
  }, [doc]);

  return (
    <div className="lp legal-page">
      <header className="site-header">
        <Link to="/" aria-label="StackPiggy home" className="wordmark">
          <img className="wordmark-logo" src="/stackpiggy-icon.png" alt="" width={34} height={34} />
          <span>stack<span className="wordmark-accent">piggy</span></span>
        </Link>
        <nav className="legal-nav" aria-label="Legal pages">
          {(Object.keys(TITLES) as LegalDoc[]).map(d => (
            <Link key={d} to={`/${d}`} aria-current={d === doc ? 'page' : undefined}>
              {NAV_LABELS[d]}
            </Link>
          ))}
        </nav>
      </header>

      <main className="section-shell legal-main">
        <section className="legal-hero">
          <p className="eyebrow"><span className="eyebrow-dot" /> STACKPIGGY LEGAL</p>
          <h1>{title}</h1>
          <p className="legal-lead">{lead}</p>
          <p className="legal-date">LAST UPDATED · {LEGAL_UPDATED.toUpperCase()}</p>
        </section>

        <div className="legal-layout">
          <aside className="legal-aside" aria-label="On this page">
            <p>ON THIS PAGE</p>
            {toc.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
          </aside>
          <article className="legal-copy">
            {children}
            <section id="contact" className="legal-contact">
              <h2>Questions?</h2>
              <p>
                Write to <Mail />. StackPiggy is run by {OPERATOR.legalName}, {OPERATOR.country}.
              </p>
            </section>
          </article>
        </div>
      </main>

      <footer className="site-footer section-shell">
        <span>© {new Date().getFullYear()} StackPiggy</span>
        <p>Payday-aware spending for the days in between.</p>
        <nav className="footer-links" aria-label="Footer">
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/refunds">Refunds</Link>
        </nav>
      </footer>
    </div>
  );
}

function Terms() {
  return (
    <Shell
      doc="terms"
      title={<>A clear plan <em>for using StackPiggy.</em></>}
      lead="The rules that apply when you create an account, use the app, or subscribe to Pro."
      toc={[['agreement', 'The agreement'], ['account', 'Your account'], ['advice', 'Planning, not advice'], ['pro', 'Pro and payments'], ['use', 'Using StackPiggy'], ['ending', 'Ending and changes'], ['liability', 'Liability'], ['contact', 'Questions']]}
    >
      <p className="legal-intro">
        StackPiggy helps you work out what you can spend between now and payday. By creating an account or
        using the app you agree to these terms and to the <Link to="/privacy">Privacy Policy</Link>.
      </p>

      <section id="agreement">
        <h2>The agreement</h2>
        <p>These terms are between you and {OPERATOR.legalName} ("we"), who runs StackPiggy. They cover the website, the app and its tools. If you do not agree, do not use StackPiggy.</p>
        <p>You must be 18 or older to use StackPiggy.</p>
      </section>

      <section id="account">
        <h2>Your account</h2>
        <p>Keep your sign-in details private. You are responsible for what happens in your account, so tell us straight away if you think someone else has used it.</p>
        <p>The figures in StackPiggy are the ones you enter. We never connect to your bank, so the plan is only as accurate as the numbers you give it.</p>
      </section>

      <section id="advice">
        <h2>Planning help, not financial advice</h2>
        <p>StackPiggy is a planning tool. It works from the details you enter and the settings you choose. It does not give investment, tax, legal, credit or financial advice, and it does not promise that a plan is right for your circumstances.</p>
        <p>Your spending, saving and payment decisions remain yours. For advice about your own situation, speak to a qualified professional.</p>
      </section>

      <section id="pro">
        <h2>Pro and payments</h2>
        <p>StackPiggy is free to use. StackPiggy Pro is an optional subscription at {PRICING.monthly.price} a month or {PRICING.annual.price} a year, in US dollars. Sales tax or VAT is added at checkout where it applies.</p>
        <p>Our order process is run by our online reseller Paddle.com, who is the Merchant of Record for all our orders. Paddle handles payment, invoices, tax, and customer service for billing questions, and its <a href="https://www.paddle.com/legal/checkout-buyer-terms" target="_blank" rel="noreferrer">buyer terms</a> apply to your purchase.</p>
        <p>A subscription renews automatically at the end of each period until you cancel. You can cancel at any time from Settings, under Manage billing. You keep Pro until the end of the period you have paid for, and you are not charged again.</p>
        <p>Refunds are covered by our <Link to="/refunds">Refund Policy</Link>. If we change the price, the new price applies from your next renewal, and we will tell you before it does.</p>
      </section>

      <section id="use">
        <h2>Using StackPiggy responsibly</h2>
        <p>Use StackPiggy lawfully. Do not try to access accounts or data that are not yours, get around security or plan limits, interfere with the service, or use automated tools that put a load on it.</p>
        <p>The app, its design and its content belong to us. These terms give you a personal, non-transferable right to use it, not ownership of it.</p>
      </section>

      <section id="ending">
        <h2>Ending your use, and changes to the app</h2>
        <p>You can stop at any time, and you can delete your account from Settings. Deleting it removes your data and cancels any active subscription.</p>
        <p>We may change, add or remove features as StackPiggy develops, and we may suspend an account that breaks these terms or puts the service at risk. We will try to give notice of significant changes but cannot promise the app will always be available or free of errors.</p>
      </section>

      <section id="liability">
        <h2>Liability</h2>
        <p>StackPiggy is provided as it is and as available. To the extent the law allows, we are not liable for indirect losses, or for financial decisions you make using the app. Nothing in these terms limits consumer rights you have where you live that cannot be excluded by agreement, such as South Africa's Consumer Protection Act, the UK Consumer Rights Act or EU consumer law.</p>
        <p>These terms are governed by the law of South Africa. If we update them, the new version appears here with a new date, and we will tell you in the app about significant changes.</p>
      </section>
    </Shell>
  );
}

function Privacy() {
  return (
    <Shell
      doc="privacy"
      title={<>Privacy, <em>without the fog.</em></>}
      lead="What we hold, what we never look at, and how to get rid of all of it."
      toc={[['collect', 'What you give us'], ['measure', 'What we measure'], ['others', 'Who else is involved'], ['where', 'Where it is stored'], ['keep', 'How long we keep it'], ['delete', 'Deleting everything'], ['rights', 'Your rights'], ['contact', 'Questions']]}
    >
      <p className="legal-intro">
        StackPiggy only works if you trust it with real numbers. We do not sell your data, we do not show ads,
        and we have no advertising partners. We never ask for access to your bank.
      </p>

      <section id="collect">
        <h2>What you give us</h2>
        <p><strong>Your account.</strong> Your first name, your email address, and a password if you do not sign in with Google. With Google sign-in we receive your email address and basic profile name from Google, nothing else.</p>
        <p><strong>Your financial plan.</strong> Everything you enter: income and paydays, bills and subscriptions, spending you log, debts, savings vaults and goals, and your daily review history. If you import a bank statement file, only the rows you choose to keep are saved.</p>
        <p><strong>What you write.</strong> Daily notes, the mood you pick, and your wishlist items with their reasons. These are stored with your account so you can look back at them. They are not used to profile you and are not sent to analytics.</p>
        <p><strong>Your PIN or fingerprint.</strong> If you lock the app, that stays on your device and is never sent to us.</p>
      </section>

      <section id="measure">
        <h2>What we measure</h2>
        <p>We record how people move through the app so we can see where it confuses them: which screens are opened, how far people get through setup, whether an upgrade prompt was seen or clicked, and crashes and errors.</p>
        <p><strong>Your financial figures are removed before any usage data leaves your device.</strong> Analytics can tell us someone stopped at the bills step, not what their bills are. We do not record your screen, and usage data is tied to a device, not to your name or email.</p>
        <p>Reminders and alerts are worked out on your device from your own data. On the phone app they are scheduled with your phone; no third-party push service receives them.</p>
      </section>

      <section id="others">
        <h2>Who else is involved</h2>
        <p>Each service below sees only what it needs to do its job.</p>
        <div className="legal-table" role="table" aria-label="Service providers">
          <div role="row"><span role="columnheader">Service</span><span role="columnheader">What it does</span><span role="columnheader">What it sees</span></div>
          <div role="row"><span role="cell">Supabase</span><span role="cell">Stores your account and plan</span><span role="cell">Your email and everything you enter</span></div>
          <div role="row"><span role="cell">Paddle</span><span role="cell">Sells Pro as Merchant of Record</span><span role="cell">Your name, email, country and payment details</span></div>
          <div role="row"><span role="cell">PostHog</span><span role="cell">Usage and crash reporting</span><span role="cell">Screens, setup progress and errors. No amounts</span></div>
          <div role="row"><span role="cell">Vercel</span><span role="cell">Hosts the app</span><span role="cell">Page requests and performance</span></div>
          <div role="row"><span role="cell">Google</span><span role="cell">Sign-in, only if you choose it</span><span role="cell">That you signed in to StackPiggy</span></div>
        </div>
        <p>Card details go straight to Paddle. They never reach us and we cannot see them. Paddle handles your payment information under its own <a href="https://www.paddle.com/legal/privacy" target="_blank" rel="noreferrer">privacy policy</a>.</p>
      </section>

      <section id="where">
        <h2>Where it is stored</h2>
        <p>Your account and plan are held by Supabase in the United States, and usage data by PostHog in the United States. Wherever you use StackPiggy from, your information is transferred to the United States so the service can work. Each provider is bound by its own data protection commitments.</p>
      </section>

      <section id="keep">
        <h2>How long we keep it</h2>
        <p>Your account and plan are kept until you delete your account. Usage data is kept for as long as our analytics provider retains it, currently about a year. Paddle keeps purchase records for as long as tax law requires.</p>
      </section>

      <section id="delete">
        <h2>Deleting everything</h2>
        <p>You can delete your account from Settings at any time. That removes your account and every record attached to it, and cancels any active subscription first. Deletion is immediate and cannot be undone. You can also export your data from Settings before you go.</p>
      </section>

      <section id="rights">
        <h2>Your rights</h2>
        <p>Wherever you live, you can ask to see what we hold, have it corrected, or have it deleted, and we will answer. Most of this you can do yourself in the app. For anything else, write to <Mail />.</p>
        <p>StackPiggy is run from South Africa, so the Protection of Personal Information Act (POPIA) applies to how we handle your information. Our information officer is {OPERATOR.informationOfficer}, contactable at <Mail />, and you may complain to South Africa's <a href="https://inforegulator.org.za/" target="_blank" rel="noreferrer">Information Regulator</a>.</p>
        <p>Your own country's law may give you further rights. In the UK and EEA, the GDPR gives you these rights formally, plus the right to object and to complain to your local data protection authority. In California and other US states with privacy laws, you have similar rights to know, correct and delete, and we never sell or share your personal information for advertising. You can also complain to your local privacy regulator wherever you live.</p>
        <p>We hold your plan because the app cannot work without it, and we measure usage because we have a legitimate interest in knowing which parts of the app do not work.</p>
        <p>StackPiggy is not intended for anyone under 18 and we do not knowingly collect their information.</p>
      </section>
    </Shell>
  );
}

function Refunds() {
  return (
    <Shell
      doc="refunds"
      title={<>Refunds, <em>plainly.</em></>}
      lead="How cancelling and refunds work for StackPiggy Pro."
      toc={[['cancel', 'Cancelling'], ['refund', 'Getting a refund'], ['how', 'How to ask'], ['contact', 'Questions']]}
    >
      <p className="legal-intro">
        StackPiggy is free to use, so you can try the daily plan before paying for anything. This page covers
        StackPiggy Pro, which is sold by our reseller Paddle.com as Merchant of Record.
      </p>

      <section id="cancel">
        <h2>Cancelling</h2>
        <p>You can cancel Pro at any time from Settings, under Manage billing. You keep Pro until the end of the period you have paid for, and you will not be charged again.</p>
        <p>Deleting your account is different: it cancels Pro straight away and access ends immediately, along with your data. If you delete your account within 14 days of a payment, you can still ask for that payment back.</p>
      </section>

      <section id="refund">
        <h2>Getting a refund</h2>
        <p>StackPiggy offers a full refund if you ask within 14 days of any Pro payment, including renewals. You do not need to give a reason. This is our own promise and is more generous than Paddle's standard refund policy.</p>
        <p>When a payment is refunded, Pro access paid for by that payment ends. After 14 days a payment is not refundable, but you can still cancel so the next one is never taken.</p>
        <p>We may decline repeated refund requests or other refund abuse. This policy adds to any rights you have under the consumer protection law of your country, and does not limit them.</p>
      </section>

      <section id="how">
        <h2>How to ask</h2>
        <p>Reply to your Paddle receipt, use Manage billing in Settings, or email <Mail />. We arrange the refund through Paddle, and it goes back to the card or account you paid with.</p>
      </section>
    </Shell>
  );
}

export function LegalPage({ doc }: { doc: LegalDoc }) {
  if (doc === 'privacy') return <Privacy />;
  if (doc === 'refunds') return <Refunds />;
  return <Terms />;
}

export default LegalPage;
