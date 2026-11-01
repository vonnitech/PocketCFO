import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Home, Smartphone, Play } from 'lucide-react';
import { PRICING, TAX_NOTE } from '../lib/pricing';
import './landing.css';

// Public landing page shown at "/" to signed-out visitors on the web.
// Styles live in landing.css, every rule scoped under `.lp` so nothing here
// leaks into the app (and the app's Tailwind classes cannot reach in).

type Feature = 'bills' | 'vaults' | 'review';
type Pace = 'flat' | 'weekend' | 'vault';

const FEATURES: Record<Feature, { kicker: string; title: string; copy: string }> = {
  bills: {
    kicker: 'COMMITMENTS BEFORE PAYDAY',
    title: 'Keep the future from quietly spending itself.',
    copy: 'Bills and subscriptions reserve cash before payday. You see the difference between money you have and money you can actually use.',
  },
  vaults: {
    kicker: 'GOALS WITH A PLACE TO LIVE',
    title: 'Save without leaving it to whatever is left.',
    copy: 'Give each goal its own vault. An emergency fund, a trip or a new phone does not have to compete with your daily spending number.',
  },
  review: {
    kicker: 'A DAILY MONEY CHECK-IN',
    title: 'Check in. Do not check out.',
    copy: 'A short Daily Review keeps the plan close to the decisions that shape it. See what was cleared, what you spent and what remains.',
  },
};

// `swept` (vault only) is the share of each bar, from the top, that went unspent
// and moved to a vault. The bar height is the day's cleared amount; the label
// under it is what was actually spent.
const PACES: Record<Pace, { label: string; note: string; values: string[]; heights: string[]; swept?: string[]; amount: string; caption: string }> = {
  flat: {
    label: 'FLAT PACE', note: 'Same number every day. Simple on purpose.',
    values: ['$60', '$60', '$60', '$60', '$60', '$60', '$60'],
    heights: ['58%', '58%', '58%', '58%', '58%', '58%', '58%'],
    amount: '$60', caption: 'Built around a flat daily pace',
  },
  weekend: {
    label: 'WEEKEND-LOADED', note: 'Trim weekdays. Make room for the weekend.',
    values: ['$48', '$48', '$48', '$48', '$48', '$90', '$90'],
    heights: ['46%', '46%', '46%', '46%', '46%', '88%', '88%'],
    amount: '$48', caption: 'Weekdays trimmed for a bigger weekend',
  },
  vault: {
    label: 'SWEEP TO VAULT', note: 'Green is what you did not spend. It moves to a vault.',
    values: ['$42', '$55', '$36', '$60', '$48', '$60', '$53'],
    heights: ['58%', '58%', '58%', '58%', '58%', '58%', '58%'],
    swept:   ['30%', '8%', '40%', '0%', '20%', '0%', '12%'],
    amount: '$60', caption: 'Leftover money sweeps into a vault',
  },
};

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const FAQS: { q: string; a: string }[] = [
  { q: 'Why not just check my bank balance?', a: 'Your balance shows cash on hand. It does not put bills, subscriptions, savings goals and the days until payday into the same decision. StackPiggy does that planning before you spend.' },
  { q: 'Do I have to connect my bank?', a: 'No. You add your own numbers, so StackPiggy never needs access to your bank. On Pro you can import a statement file (CSV or Excel) instead of typing every spend.' },
  { q: 'Does every day have to look the same?', a: 'No. Keep an even daily pace, make more room for weekends, or choose whether underspend rolls forward or lands in a savings vault.' },
  { q: 'What do I get for free?', a: 'The full daily plan: your cleared amount, bills set aside, Daily Review, up to 3 savings vaults, the wishlist and the everyday calculators. Pro adds statement import, unlimited vaults and the long-term planning tools.' },
];

const LOGO = '/stackpiggy-icon.png';

function Wordmark() {
  return (
    <span className="wordmark">
      <img className="wordmark-logo" src={LOGO} alt="" width={34} height={34} />
      <span>stack<span className="wordmark-accent">piggy</span></span>
    </span>
  );
}

export function LandingPage() {
  const [feature, setFeature] = useState<Feature>('bills');
  const [pace, setPace] = useState<Pace>('flat');
  const [openFaq, setOpenFaq] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'StackPiggy | Know what you can spend today';
    const fontHref = 'https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700;800&display=swap';
    if (!document.querySelector(`link[href="${fontHref}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = fontHref;
      document.head.appendChild(link);
    }
    return () => { document.title = prevTitle; };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('is-visible'); }),
      { threshold: 0.12 },
    );
    root.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const f = FEATURES[feature];
  const p = PACES[pace];

  return (
    <div className="lp lp-js" ref={rootRef}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <div className="page-noise" aria-hidden="true" />

      <header className="site-header" id="top">
        <a href="#top" aria-label="StackPiggy home"><Wordmark /></a>
        <nav className="desktop-nav" aria-label="Primary navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#pacing">Pacing</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="header-actions">
          <Link className="nav-signin" to="/login">Sign in</Link>
          <Link className="nav-cta" to="/signup">Create account <span aria-hidden="true">→</span></Link>
        </div>
      </header>

      <main id="main-content">
        <section className="hero section-shell" aria-labelledby="hero-title">
          <div className="hero-copy reveal">
            <p className="eyebrow"><span className="eyebrow-dot" /> PAYDAY-AWARE SPENDING</p>
            <h1 id="hero-title">Know what you can spend <em>today.</em></h1>
            <p className="hero-intro">
              StackPiggy sets aside the money you have planned for bills and savings, then shows what is clear to spend between now and payday.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" to="/signup">Create your account <span aria-hidden="true">→</span></Link>
              <a className="text-link" href="#how-it-works">See the maths behind it <span aria-hidden="true">↓</span></a>
            </div>
            <p className="microcopy">Free to start. You add your own numbers, no bank access needed.</p>
          </div>

          <div className="hero-product reveal reveal-delay" role="img" aria-label="Example of the StackPiggy dashboard">
            <div className="product-topline">
              <span className="live-pill"><i /> TODAY'S PLAN</span>
              <span className="product-date">FRI · OCT 16</span>
            </div>
            <div className="cleared-card">
              <span className="card-label">CLEARED TODAY</span>
              <strong>{p.amount}<span>.00</span></strong>
              <div className="amount-rule"><span /></div>
              <p>{p.caption}</p>
            </div>
            <div className="dashboard-rail">
              <div className="metric-card metric-dark">
                <span>PAYDAY IN</span>
                <strong>9 <small>DAYS</small></strong>
                <p>Long stretch. Trust the system.</p>
              </div>
              <div className="metric-card metric-yellow">
                <span>RESERVED</span>
                <strong>$940</strong>
                <p>Bills and savings protected</p>
              </div>
            </div>
            <div className="dashboard-foot">
              <span>SPENDABLE <strong>$2,000</strong></span>
              <span className="status-good">● ON TRACK</span>
            </div>
            <div className="cursor-tag cursor-one">Bills first</div>
            <div className="cursor-tag cursor-two">Then spend</div>
          </div>
        </section>

        <section className="proof-strip" aria-label="StackPiggy principles">
          <p>YOUR BALANCE IS A RECORD</p><span>✦</span><p>YOUR CLEARED AMOUNT IS A DECISION</p><span>✦</span><p>PAYDAY IS STILL IN VIEW</p>
        </section>

        <section className="tension section-shell" aria-labelledby="tension-title">
          <div className="tension-kicker reveal">
            <span className="number-chip">01</span>
            <p>THE PROBLEM WITH A BALANCE</p>
          </div>
          <div className="tension-content reveal">
            <h2 id="tension-title">A balance is what you have.<br /><span>A plan is what you can use.</span></h2>
            <div className="tension-copy">
              <p>Your balance does not know rent is coming up. It does not know which subscription renews next week. And it definitely does not know what you meant to save this month.</p>
              <p><strong>So you either spend and hope, or skip things because you are not sure.</strong></p>
              <p className="pull-quote">What can I spend today and still be ready for payday?</p>
            </div>
          </div>
        </section>

        <section className="plan-pipeline" id="how-it-works" aria-labelledby="pipeline-title">
          <div className="section-shell">
            <div className="section-heading reveal">
              <p className="eyebrow eyebrow-light"><span className="eyebrow-dot" /> THE STACKPIGGY METHOD</p>
              <h2 id="pipeline-title">Bills and savings first.<br /><em>Then spend.</em></h2>
            </div>
            <div className="pipeline-steps">
              <article className="pipeline-step reveal">
                <span className="step-no">01</span>
                <div className="step-icon icon-calendar" aria-hidden="true"><span /></div>
                <h3>Set the baseline.</h3>
                <p>Add your balance, take-home pay, next payday and regular bills. That gives your money a time horizon.</p>
              </article>
              <article className="pipeline-step reveal reveal-delay">
                <span className="step-no">02</span>
                <div className="step-icon icon-funnel" aria-hidden="true"><span /></div>
                <h3>Clear the commitments.</h3>
                <p>Bills, subscriptions and savings stop pretending to be "later". They get a place in the plan now.</p>
              </article>
              <article className="pipeline-step reveal reveal-delay-2">
                <span className="step-no">03</span>
                <div className="step-icon icon-spark" aria-hidden="true">✦</div>
                <h3>Spend with context.</h3>
                <p>What remains becomes a daily amount you can use, with payday still in view.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="feature-stage section-shell" aria-labelledby="feature-title">
          <div className="feature-side reveal">
            <p className="eyebrow"><span className="eyebrow-dot" /> NOT A CATEGORY SPREADSHEET</p>
            <h2 id="feature-title">Make one number do the hard part.</h2>
            <p className="feature-lead">The dashboard turns a moving pay cycle into a decision you can make in seconds.</p>
            <div className="feature-selector" role="group" aria-label="StackPiggy core capabilities">
              {(['bills', 'vaults', 'review'] as Feature[]).map((id, i) => (
                <button
                  key={id}
                  type="button"
                  className={`feature-tab${feature === id ? ' is-active' : ''}`}
                  aria-pressed={feature === id}
                  onClick={() => setFeature(id)}
                >
                  {id === 'bills' ? 'Bills & subscriptions' : id === 'vaults' ? 'Savings vaults' : 'Daily review'}
                  <span>0{i + 1}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="feature-screen reveal reveal-delay">
            <div className="feature-screen-header">
              <span className="window-dots"><i /><i /><i /></span>
              <span>{f.kicker}</span>
            </div>
            <div className="feature-screen-body">
              <div className="feature-screen-title">
                <h3>{f.title}</h3>
                <p>{f.copy}</p>
              </div>
              <div className="visual-panel swap-in" key={feature} aria-hidden="true">
                {feature === 'bills' && (
                  <>
                    <div className="bill-row"><span className="bill-icon"><Home size={12} strokeWidth={2.5} aria-hidden /></span><span>Rent</span><strong>$680</strong><i /></div>
                    <div className="bill-row"><span className="bill-icon"><Smartphone size={12} strokeWidth={2.5} aria-hidden /></span><span>Phone</span><strong>$45</strong><i /></div>
                    <div className="bill-row"><span className="bill-icon"><Play size={11} strokeWidth={2.5} aria-hidden /></span><span>Streaming</span><strong>$16</strong><i /></div>
                    <div className="reserved-total"><span>RESERVED BEFORE PAYDAY</span><strong>$741</strong></div>
                  </>
                )}
                {feature === 'vaults' && (
                  <>
                    <div className="vault-visual"><div className="vault-top"><span>HOLIDAY VAULT</span><b>68%</b></div><strong>$680 <small>of $1,000</small></strong><div className="vault-progress"><i /></div><p>+$35 swept from surplus</p></div>
                    <div className="vault-visual vault-small"><div className="vault-top"><span>RAINY DAY</span><b>24%</b></div><strong>$240 <small>of $1,000</small></strong><div className="vault-progress"><i /></div></div>
                  </>
                )}
                {feature === 'review' && (
                  <>
                    <div className="review-mini"><div><span>CLEARED</span><strong>$60.00</strong></div><div><span>SPENT</span><strong>$18.50</strong></div><div><span>LEFT</span><strong className="review-green">$41.50</strong></div></div>
                    <div className="mini-progress"><i /></div>
                    <div className="mini-moods"><span className="selected">STEADY</span><span>STRETCHED</span><span>NO-SPEND</span></div>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="pacing-section" id="pacing" aria-labelledby="pacing-title">
          <div className="section-shell pacing-layout">
            <div className="pacing-copy reveal">
              <p className="eyebrow eyebrow-light"><span className="eyebrow-dot" /> YOUR PLAN, YOUR RHYTHM</p>
              <h2 id="pacing-title">Pace money around your life, not someone else's budget.</h2>
              <p>You decide <strong>when</strong> your cleared amount is available. Keep it level, load it toward the weekend, or sweep underspend into a vault.</p>
              <div className="pace-controls" role="group" aria-label="Example pace options">
                {([
                  ['flat', 'Flat', 'same every day'],
                  ['weekend', 'Weekend-loaded', 'more when it matters'],
                  ['vault', 'Sweep to vault', 'save the leftover'],
                ] as [Pace, string, string][]).map(([id, label, sub]) => (
                  <button
                    key={id}
                    type="button"
                    className={`pace-button${pace === id ? ' is-active' : ''}`}
                    aria-pressed={pace === id}
                    onClick={() => setPace(id)}
                  >
                    {label} <small>{sub}</small>
                  </button>
                ))}
              </div>
            </div>
            <div className="pace-board reveal reveal-delay" aria-label="Example pacing board">
              <div className="pace-board-top"><span>9 DAYS TO PAYDAY</span><strong>{p.label}</strong></div>
              <div className="day-bars">
                {DAYS.map((d, i) => (
                  <div key={i} className={pace === 'weekend' && i >= 5 ? 'weekend' : undefined}>
                    <span>{d}</span>
                    <i style={{ ['--h' as string]: p.heights[i] }}>
                      {p.swept && p.swept[i] !== '0%' && <b style={{ height: p.swept[i] }} />}
                    </i>
                    <strong>{p.values[i]}</strong>
                  </div>
                ))}
              </div>
              <div className="pace-note"><span>↳</span> {p.note}</div>
            </div>
          </div>
        </section>

        <section className="daily-section section-shell" aria-labelledby="daily-title">
          <div className="daily-card reveal">
            <div className="daily-card-top"><span>DAILY REVIEW</span><span className="on-track">● ON TRACK</span></div>
            <div className="daily-numbers">
              <div><span>CLEARED TODAY</span><strong>$60.00</strong></div>
              <div><span>SPEND LOGGED</span><strong>$18.50</strong></div>
              <div className="remaining"><span>REMAINING</span><strong>$41.50</strong></div>
            </div>
            <div className="daily-progress"><span style={{ width: '31%' }} /></div>
            <p>"Dinner with friends. Still steady."</p>
            <div className="mood-row"><span>STEADY</span><span>STRETCHED</span><span>BROKE</span><span>NO-SPEND</span></div>
          </div>
          <div className="daily-copy reveal reveal-delay">
            <p className="eyebrow"><span className="eyebrow-dot" /> A FIVE-MINUTE MONEY HABIT</p>
            <h2 id="daily-title">Check in.<br />Do not check out.</h2>
            <p>The Daily Review turns awareness into something you can repeat. See what was cleared, add what you spent and leave a quick note about how the day went.</p>
            <p>You are not trying to be perfect. You are keeping the plan close to the decisions that shape it.</p>
          </div>
        </section>

        <section className="ledger-section" aria-labelledby="ledger-title">
          <div className="section-shell ledger-layout">
            <div className="ledger-copy reveal">
              <p className="eyebrow eyebrow-light"><span className="eyebrow-dot" /> PRESENT VS. FUTURE</p>
              <h2 id="ledger-title">See where money goes.<br /><em>See what it builds.</em></h2>
              <p>Log and review the activity behind your cleared amount. StackPiggy separates everyday spending from the money you put toward a future goal.</p>
              <Link className="button button-outline-light" to="/signup">Build my spending plan <span aria-hidden="true">→</span></Link>
            </div>
            <div className="ledger-ui reveal reveal-delay" aria-label="Example StackPiggy ledger and breakdown">
              <div className="ledger-tabs"><span className="is-selected">LEDGER</span><span>BREAKDOWN</span></div>
              <div className="ledger-lines">
                <div><span className="ledger-dot food" /><span>Lunch</span><small>TODAY</small><strong>−$18.50</strong></div>
                <div><span className="ledger-dot bill" /><span>Internet</span><small>FRI</small><strong>−$52.00</strong></div>
                <div><span className="ledger-dot vault" /><span>Holiday vault</span><small>FRI</small><strong>+$35.00</strong></div>
              </div>
              <div className="allocation-block">
                <div className="allocation-heading"><span>CAPITAL ALLOCATION</span><span>OCTOBER</span></div>
                <div className="allocation-bar"><i /><b /></div>
                <div className="allocation-legend"><span><i className="legend-lifestyle" /> LIFESTYLE BURN</span><span><i className="legend-future" /> FUTURE WEALTH</span></div>
              </div>
            </div>
          </div>
        </section>

        <section className="map-section section-shell" aria-labelledby="map-title">
          <div className="map-intro reveal">
            <p className="eyebrow"><span className="eyebrow-dot" /> HOW IT FITS TOGETHER</p>
            <h2 id="map-title">Every bit you save has <em>somewhere to go.</em></h2>
            <p>Money you don't spend doesn't just sit there. It flows into vaults for your goals, and your investment vaults build the long-term plan.</p>
          </div>
          <div className="map-flow reveal reveal-delay">
            <div className="map-col">
              <div className="map-node"><strong>Wishlist</strong><span>"Save for this" starts a vault</span></div>
              <div className="map-node"><strong>Daily review</strong><span>Regret a spend? Move the same amount to a vault</span></div>
              <div className="map-node"><strong>Leftover cash</strong><span>Underspend is swept, not lost</span></div>
              <div className="map-node"><strong>Payday</strong><span>Fund your vaults the day pay lands</span></div>
            </div>
            <div className="map-arrow" aria-hidden="true">→</div>
            <div className="map-hub">
              <span>WHERE IT ADDS UP</span>
              <strong>Vaults</strong>
              <p>One vault per goal: an emergency fund, a holiday, a new phone. Watch each one fill.</p>
            </div>
            <div className="map-arrow" aria-hidden="true">→</div>
            <div className="map-col">
              <div className="map-node map-node-dark"><strong>FIRE plan <b>PRO</b></strong><span>Investment vaults count toward your financial independence number</span></div>
              <div className="map-node"><strong>Income tracker <b>PRO</b></strong><span>Your savings rate feeds the plan</span></div>
            </div>
          </div>
        </section>

        <section className="pricing-section" id="pricing" aria-labelledby="pricing-title">
          <div className="section-shell">
            <div className="pricing-intro reveal">
              <p className="eyebrow eyebrow-light"><span className="eyebrow-dot" /> PRICING</p>
              <h2 id="pricing-title">Free to start.<br /><em>Pro when you're ready.</em></h2>
            </div>
            <div className="pricing-grid">
              <article className="price-card reveal">
                <h3>Free</h3>
                <p className="price-figure">$0</p>
                <ul>
                  <li>Your daily cleared amount</li>
                  <li>Bills set aside before payday</li>
                  <li>Daily review and pacing</li>
                  <li>Up to 3 savings vaults</li>
                  <li>Wishlist, bill splitter, true cost and safety net</li>
                  <li>Customise your colours with one pairing</li>
                </ul>
                <Link className="button button-ghost" to="/signup">Start free <span aria-hidden="true">→</span></Link>
              </article>
              <article className="price-card price-card-pro reveal reveal-delay">
                <div className="price-card-top">
                  <h3>Pro</h3>
                  <span className="price-badge">ANNUAL: 4 MONTHS FREE</span>
                </div>
                <p className="pro-lead">Stop typing every spend. Import your bank statement and StackPiggy sorts it for you.</p>
                <div className="price-options">
                  <div><strong>{PRICING.monthly.price}</strong><span>per month</span></div>
                  <div className="is-best"><strong>{PRICING.annual.price}</strong><span>per year</span></div>
                </div>
                <p className="price-tax">{TAX_NOTE}</p>
                <ul>
                  <li>Everything in Free</li>
                  <li>Import bank statements (CSV or Excel)</li>
                  <li>Unlimited vaults, one for every goal</li>
                  <li>Debt payoff, FIRE plan and income tracker</li>
                  <li>PDF money reports</li>
                  <li>Customise with every colour pairing</li>
                </ul>
                <Link className="button button-primary" to="/signup">Start free, upgrade anytime <span aria-hidden="true">→</span></Link>
              </article>
            </div>
          </div>
        </section>

        <section className="faq-section section-shell" id="faq" aria-labelledby="faq-title">
          <div className="faq-intro reveal">
            <p className="eyebrow"><span className="eyebrow-dot" /> GOOD QUESTIONS</p>
            <h2 id="faq-title">This is not another budget you have to be perfect at.</h2>
          </div>
          <div className="faq-list reveal reveal-delay">
            {FAQS.map((item, i) => (
              <details
                key={item.q}
                open={openFaq === i}
                onToggle={e => {
                  const isOpen = (e.currentTarget as HTMLDetailsElement).open;
                  if (isOpen) setOpenFaq(i);
                  else if (openFaq === i) setOpenFaq(-1);
                }}
              >
                <summary>{item.q}<span aria-hidden="true">+</span></summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="closing section-shell">
          <div className="closing-card reveal">
            <div className="closing-stamp" aria-hidden="true">✦</div>
            <p className="eyebrow"><span className="eyebrow-dot" /> A BETTER QUESTION FOR TODAY</p>
            <h2>Stop guessing what your balance means.</h2>
            <p>Set bills and savings aside. See what is clear for today. Keep your next payday in view.</p>
            <Link className="button button-primary" to="/signup">Create your account <span aria-hidden="true">→</span></Link>
          </div>
        </section>
      </main>

      <footer className="site-footer section-shell">
        <a href="#top" aria-label="Back to top"><Wordmark /></a>
        <p>Payday-aware spending for the days in between.</p>
        <div className="footer-links">
          <a href="mailto:hello@stackpiggy.com">hello@stackpiggy.com</a>
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/refunds">Refunds</Link>
          <Link to="/login">Sign in →</Link>
        </div>
      </footer>
    </div>
  );
}
