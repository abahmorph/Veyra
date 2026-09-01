import { motion } from 'framer-motion';

export default function AmbientBackground() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      <motion.div
        animate={{ x: [0, 30, -20, 0], y: [0, -20, 10, 0], scale: [1, 1.1, 0.9, 1] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full bg-accent/15 blur-[180px]"
      />
      <motion.div
        animate={{ x: [0, -30, 20, 0], y: [0, 20, -10, 0], scale: [1, 0.9, 1.1, 1] }}
        transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-cyan/10 blur-[160px]"
      />
      <motion.div
        animate={{ x: [0, 20, -30, 0], y: [0, 15, -15, 0], scale: [1, 1.05, 0.95, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-[40%] left-[50%] w-[400px] h-[400px] rounded-full bg-veyra/8 blur-[140px]"
      />
    </div>
  );
}
