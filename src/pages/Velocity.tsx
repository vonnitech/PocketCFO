import { Link } from 'react-router-dom';
import { VelocityConfig } from '../components/VelocityConfig';

export default function Velocity() {
  return (
    <div className="space-y-5 max-w-xl mx-auto">
      <div>
        <h1 className="text-4xl font-black uppercase tracking-tighter leading-tight italic text-text-main">
          Pacing
        </h1>
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">
          Sets when your cleared amount is available, not how much there is
        </p>
      </div>

      <VelocityConfig />

      {/* The spend tier used to sit above this. It scales the daily number and
          the pacing then reshapes what is left, so the two compound, but that
          made them read as one mechanism with six dials. They are separate
          questions and get separate screens; the link keeps the relationship
          visible without putting them back in one place. */}
      <Link
        to="/limit"
        className="flex items-center justify-between gap-3 bg-surface border-4 border-border rounded-2xl px-4 py-3 hover:border-black transition-colors"
      >
        <span className="text-[10px] font-bold uppercase tracking-wide text-text-muted leading-snug">
          Pacing works off your spend limit, which sets the amount being spread
        </span>
        <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-text-main">
          Spend Limit →
        </span>
      </Link>
    </div>
  );
}
