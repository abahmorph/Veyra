import { motion } from 'framer-motion';

const ease = [0.16, 1, 0.3, 1] as const;

export default function SplashScreen() {
  return (
    <motion.div
      exit={{ opacity: 0, scale: 1.04, filter: 'blur(8px)' }}
      transition={{ duration: 0.6, ease: 'easeInOut' }}
      className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-void overflow-hidden"
    >
      <motion.div
        animate={{ opacity: [0.35, 0.7, 0.35], scale: [1, 1.18, 1] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute w-[460px] h-[460px] rounded-full bg-veyra/15 blur-[130px]"
      />
      <motion.div
        animate={{ opacity: [0.25, 0.5, 0.25] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
        className="absolute w-[300px] h-[300px] rounded-full bg-cyan/10 blur-[110px] translate-x-40"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease }}
        className="relative flex flex-col items-center"
      >
        <svg
          width="170"
          height="150"
          viewBox="0 0 170 150"
          fill="none"
          className="drop-shadow-[0_0_30px_rgba(20,241,149,0.45)]"
        >
          <motion.path
            d="M30 25 L85 128"
            stroke="var(--color-veyra)"
            strokeWidth="17"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, ease: 'easeInOut' }}
          />
          <motion.path
            d="M85 128 L140 25"
            stroke="var(--color-veyra)"
            strokeWidth="17"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, delay: 0.18, ease: 'easeInOut' }}
          />
        </svg>

        <motion.div
          initial={{ opacity: 0, y: 14, letterSpacing: '0.55em' }}
          animate={{ opacity: 1, y: 0, letterSpacing: '0.05em' }}
          transition={{ delay: 0.95, duration: 0.8, ease }}
          className="mt-8 font-display text-4xl font-bold text-ink"
        >
          <span className="text-veyra">V</span>eyra
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.55, duration: 0.6, ease }}
          className="mt-2 text-[11px] uppercase tracking-[0.28em] text-ink-faint"
        >
          AI Video Studio
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.9, duration: 0.6, ease }}
          className="mt-6 text-[10px] uppercase tracking-[0.34em] text-ink-faint/70"
        >
          Xmorph Productions
        </motion.div>
      </motion.div>

      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-edge/40">
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 3, ease: 'easeInOut' }}
          className="h-full origin-left bg-gradient-to-r from-veyra to-cyan"
        />
      </div>
    </motion.div>
  );
}
