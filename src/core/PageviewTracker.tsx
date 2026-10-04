import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { capturePageview } from './analytics';

// Records a page view on first load and on every in-app navigation. Without
// this a single-page app reports only the entry page, which leaves Web
// Analytics showing traffic arriving and never moving.
//
// Renders nothing; it exists to sit inside the router and watch location.
export default function PageviewTracker() {
  const { pathname } = useLocation();

  useEffect(() => {
    capturePageview();
  }, [pathname]);

  return null;
}
