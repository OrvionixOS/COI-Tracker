import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 3500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0, y: '10%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '-10%', filter: 'blur(10px)' }}
      transition={{ duration: 1.2, ease: [0.25, 1, 0.35, 1] }}
    >
      <div className="absolute left-[10vw] top-[50%] -translate-y-[50%] z-10">
        <motion.div
          className="text-[#c9a84c] font-mono text-[1vw] tracking-[0.3em] uppercase mb-6"
          initial={{ opacity: 0, x: -20 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
          transition={{ duration: 1 }}
        >
          The Solution
        </motion.div>

        <motion.div 
          className="text-[6vw] font-bold text-[#f0ece4] leading-none mb-6 tracking-tight flex items-baseline gap-2"
          style={{ fontFamily: 'var(--font-display)' }}
          initial={{ opacity: 0, filter: 'blur(20px)' }}
          animate={phase >= 2 ? { opacity: 1, filter: 'blur(0px)' } : { opacity: 0, filter: 'blur(20px)' }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        >
          Attest
          <span className="text-[#c9a84c] text-[2vw] relative -top-[1.5vw]">•</span>
          COI
        </motion.div>
        
        <motion.p
          className="text-[2vw] text-[#f0ece4]/80 max-w-[40vw] leading-snug"
          style={{ fontFamily: 'var(--font-display)' }}
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 1, delay: 0.4 }}
        >
          Automating COI tracking end-to-end.
        </motion.p>
      </div>
      
      {/* Decorative vertical line */}
      <motion.div 
        className="absolute right-[30vw] top-[20vh] w-[1px] bg-[#c9a84c]/30"
        initial={{ height: 0 }}
        animate={phase >= 1 ? { height: '60vh' } : { height: 0 }}
        transition={{ duration: 2, ease: 'easeInOut' }}
      />
    </motion.div>
  );
}