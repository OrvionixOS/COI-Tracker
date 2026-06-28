import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2500),
      setTimeout(() => setPhase(4), 4000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center bg-[#1a1714]/80 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.5, ease: 'easeInOut' }}
    >
      <div className="text-center z-10 flex flex-col items-center">
        <motion.h1 
          className="text-[6vw] text-[#f0ece4] leading-[1] mb-6"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <motion.span
            className="block"
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 1.2, ease: [0.25, 1, 0.35, 1] }}
          >
            Confident compliance.
          </motion.span>
          <motion.span
            className="block text-[#c9a84c] italic"
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 1.2, ease: [0.25, 1, 0.35, 1] }}
          >
            Zero missed renewals.
          </motion.span>
        </motion.h1>

        <motion.div 
          className="mt-12 flex items-baseline justify-center gap-2"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={phase >= 3 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
          transition={{ duration: 1, ease: 'easeOut' }}
        >
          <span className="text-[2vw] font-bold tracking-tight text-[#f0ece4]" style={{ fontFamily: 'var(--font-display)' }}>Attest</span>
          <span className="text-[#c9a84c] text-[1vw] relative -top-[0.8vw]">•</span>
          <span className="text-[2vw] font-bold tracking-tight text-[#f0ece4]" style={{ fontFamily: 'var(--font-display)' }}>COI</span>
        </motion.div>
      </div>
    </motion.div>
  );
}