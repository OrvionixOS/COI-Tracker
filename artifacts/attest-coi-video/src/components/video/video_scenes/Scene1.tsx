import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 4000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0, scale: 1.05 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
      transition={{ duration: 1.5, ease: [0.25, 1, 0.35, 1] }}
    >
      <div className="text-center px-12 z-10 flex flex-col items-center">
        <motion.div
          className="text-[#c9a84c] font-mono text-[1.2vw] tracking-[0.3em] uppercase mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 1, ease: 'easeOut' }}
        >
          The Problem
        </motion.div>

        <motion.h1 
          className="text-[5vw] text-[#f0ece4] leading-[1.1] max-w-[80vw]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {'Chasing vendor insurance'.split(' ').map((word, i) => (
            <motion.span 
              key={i} 
              className="inline-block mr-[1.5vw]"
              initial={{ opacity: 0, y: 40, rotateX: 45 }}
              animate={phase >= 2 ? { opacity: 1, y: 0, rotateX: 0 } : { opacity: 0, y: 40, rotateX: 45 }}
              transition={{ duration: 1.2, delay: i * 0.1, ease: [0.25, 1, 0.35, 1] }}
            >
              {word}
            </motion.span>
          ))}
        </motion.h1>
        
        <motion.h2
          className="text-[4.5vw] text-[#f0ece4]/60 italic leading-[1.1] mt-4"
          style={{ fontFamily: 'var(--font-display)' }}
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 1.2, delay: 0.5, ease: [0.25, 1, 0.35, 1] }}
        >
          is a compliance nightmare.
        </motion.h2>
      </div>
    </motion.div>
  );
}