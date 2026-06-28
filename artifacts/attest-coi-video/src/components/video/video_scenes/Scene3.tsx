import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 800),
      setTimeout(() => setPhase(3), 1800),
      setTimeout(() => setPhase(4), 4500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
    >
      <div className="absolute right-[10vw] top-[50%] -translate-y-[50%] z-10 w-[40vw]">
        <motion.div
          className="text-[#c9a84c] font-mono text-[1vw] tracking-[0.2em] uppercase mb-4"
          initial={{ opacity: 0, x: 20 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
          transition={{ duration: 1 }}
        >
          01 / Extraction
        </motion.div>

        <motion.h2 
          className="text-[4vw] text-[#f0ece4] leading-[1.1] mb-8"
          style={{ fontFamily: 'var(--font-display)' }}
          initial={{ opacity: 0, y: 30 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 1.2, ease: [0.25, 1, 0.35, 1] }}
        >
          Upload PDF. <br/><span className="text-[#f0ece4]/60 italic">AI Extracts Data.</span>
        </motion.h2>

        <motion.div 
          className="bg-[#f0ece4]/5 border border-[#c9a84c]/20 p-6 backdrop-blur-sm relative overflow-hidden"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={phase >= 3 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
          transition={{ duration: 1 }}
        >
          <div className="flex flex-col gap-4 font-mono text-[0.9vw] text-[#f0ece4]/70">
            <div className="flex justify-between border-b border-[#c9a84c]/10 pb-2">
              <span>GENERAL LIABILITY</span>
              <motion.span 
                className="text-[#c9a84c]"
                initial={{ opacity: 0 }}
                animate={phase >= 3 ? { opacity: 1 } : { opacity: 0 }}
                transition={{ delay: 0.5 }}
              >$2,000,000</motion.span>
            </div>
            <div className="flex justify-between border-b border-[#c9a84c]/10 pb-2">
              <span>EXPIRY DATE</span>
              <motion.span 
                className="text-[#c9a84c]"
                initial={{ opacity: 0 }}
                animate={phase >= 3 ? { opacity: 1 } : { opacity: 0 }}
                transition={{ delay: 0.7 }}
              >2025-10-31</motion.span>
            </div>
          </div>
          
          {/* Scanning line effect */}
          <motion.div 
            className="absolute left-0 right-0 h-[1px] bg-[#c9a84c] shadow-[0_0_10px_#c9a84c]"
            initial={{ top: '-10%', opacity: 0 }}
            animate={phase >= 3 ? { top: '110%', opacity: [0, 1, 1, 0] } : { top: '-10%', opacity: 0 }}
            transition={{ duration: 2, delay: 0.2, ease: 'linear' }}
          />
        </motion.div>
      </div>
    </motion.div>
  );
}