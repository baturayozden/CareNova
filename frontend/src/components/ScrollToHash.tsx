import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollToHash() {
  const { hash, pathname } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const id = hash.replace('#', '');
    let tries = 0;
    const tryScroll = () => {
      const el = document.getElementById(id);
      if (el) { el.scrollIntoView({ behavior: 'smooth' }); return; }
      if (tries++ < 25) setTimeout(tryScroll, 100);
    };
    tryScroll();
  }, [hash, pathname]);
  return null;
}
