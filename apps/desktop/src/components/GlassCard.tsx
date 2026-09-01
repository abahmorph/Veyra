import { motion } from 'framer-motion';

export default function GlassCard({ children, className = '', onClick, hoverEffect = true }: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverEffect?: boolean;
}) {
  return (
    <motion.div
      onClick={onClick}
      whileHover={hoverEffect ? { y: -4, transition: { duration: 0.3 } } : undefined}
      className={`glass-panel rounded-2xl ${className} ${hoverEffect ? 'transition-all duration-300 cursor-pointer' : ''}`}
    >
      {children}
    </motion.div>
  );
}
