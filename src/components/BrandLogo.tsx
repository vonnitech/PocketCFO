// The wordmark is near-black in the light file and white in the dark one, so a
// single image would leave the name invisible in one theme. Both are rendered
// and CSS picks, which avoids a flash while JS works out the theme.
export function BrandLogo() {
  const shared = 'h-12 w-auto max-w-[16rem] shrink-0 object-contain';

  return (
    <div className="flex items-center select-none">
      <img
        src="/stackpiggy-logo.svg"
        alt="StackPiggy"
        width={1505}
        height={400}
        className={`${shared} dark:hidden`}
      />
      <img
        src="/stackpiggy-logo-dark.svg"
        alt=""
        aria-hidden="true"
        width={1505}
        height={400}
        className={`${shared} hidden dark:block`}
      />
    </div>
  );
}
