import { BrandLogo } from './BrandLogo';

// Brand mark only. The menu that used to live here moved into the bottom bar,
// so every navigation control sits in one thumb-reachable place and the More
// sheet rises from the edge its trigger is on rather than the opposite one.
export default function TopHeader() {
  return (
    <header className="shrink-0 z-50 w-full flex items-center px-4 pb-3 header-pt-safe bg-base border-b-[3px] border-border transition-colors duration-300">
      <BrandLogo />
    </header>
  );
}
