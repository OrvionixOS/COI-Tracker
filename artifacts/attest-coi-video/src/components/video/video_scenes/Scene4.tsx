import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 800),
      setTimeout(() => setPhase(3), 1500),
      setTimeout(() => setPhase(4), 4000),
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
      <div className="absolute left-[10vw] top-[50%] -translate-y-[50%] z-10 w-[40vw]">
        <motion.div
          className="text-[#c9a84c] font-mono text-[1vw] tracking-[0.2em] uppercase mb-4"
          initial={{ opacity: 0, x: -20 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
          transition={{ duration: 1 }}
        >
          02 / Dashboard
        </motion.div>

        <motion.h2 
          className="text-[3.5vw] text-[#f0ece4] leading-[1.1] mb-6"
          style={{ fontFamily: 'var(--font-display)' }}
          initial={{ opacity: 0, y: 30 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 1.2, ease: [0.25, 1, 0.35, 1] }}
        >
          Compliance Dashboard. <br/><span className="text-[#f0ece4]/60 italic">Automated reminders.</span>
        </motion.h2>

        <div className="flex flex-col gap-3">
          {[
            { status: 'COMPLIANT', color: '#c9a84c', vendor: 'Apex Roofing' },
            { status: 'EXPIRING SOON', color: '#e8aa51', vendor: 'City Plumbing' },
            { status: 'NON-COMPLIANT', color: '#a04848', vendor: 'Express HVAC' }
          ].map((item, i) => (
            <motion.div 
              key={i}
              className="flex items-center justify-between border-b border-[#f0ece4]/10 pb-3"
              initial={{ opacity: 0, x: -20 }}
              animate={phase >= 3 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
              transition={{ duration: 0.8, delay: i * 0.2 }}
            >
              <span className="font-mono text-[1vw] text-[#f0ece4]">{item.vendor}</span>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[0.8vw]" style={{ color: item.color }}>{item.status}</span>
                {i === 1 && (
                  <motion.div 
                    className="w-2 h-2 rounded-full bg-[#e8aa51]"
                    animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}