import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronUp } from 'lucide-react';

const THRESHOLD = 400;

export default function ScrollToTopButton() {
  const reduced  = useReducedMotion();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > THRESHOLD);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          key="scroll-top"
          initial={reduced ? { opacity: 1 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: reduced ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ scale: reduced ? 1 : 1.08 }}
          whileTap={{ scale: reduced ? 1 : 0.93 }}
          onClick={() => window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })}
          aria-label="Scroll to top"
          style={{
            position: 'fixed', bottom: 32, right: 32,
            width: 46, height: 46, borderRadius: '50%',
            background: '#0f172a',
            color: '#ffffff',
            border: '1px solid rgba(255,255,255,0.18)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 28px rgba(15,23,42,0.22)',
            zIndex: 40,
          }}
        >
          <ChevronUp size={20} strokeWidth={2.5} />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
