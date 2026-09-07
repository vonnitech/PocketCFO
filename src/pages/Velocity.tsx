import { VelocityConfig } from '../components/VelocityConfig';

export default function Velocity() {
  return (
    <div className="space-y-5 max-w-xl mx-auto">
      <div>
        <h1 className="text-4xl font-black uppercase tracking-tighter leading-tight italic text-text-main">
          Velocity
        </h1>
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1.5">
          Controls when the allowance burns, not how much
        </p>
      </div>

      <VelocityConfig />
    </div>
  );
}
