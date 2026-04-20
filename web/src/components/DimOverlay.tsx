import { AnimatePresence, motion } from 'framer-motion';

type Props = {
  show: boolean;
  opacity: number; // 0..1
};

export default function DimOverlay({ show, opacity }: Props) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="pointer-events-none absolute inset-0 z-20 bg-black"
        />
      )}
    </AnimatePresence>
  );
}
