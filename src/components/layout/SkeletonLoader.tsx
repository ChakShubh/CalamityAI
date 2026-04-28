import { motion } from 'framer-motion';

export default function SkeletonLoader() {
  return (
    <motion.div
      className="flex-1 p-4 space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex gap-4 h-full">
        {/* Sidebar skeleton */}
        <div className="w-72 space-y-3 flex-shrink-0">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-skeleton rounded-xl h-20" style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
        {/* Main content skeleton */}
        <div className="flex-1 space-y-4">
          <div className="animate-skeleton rounded-2xl h-[55%]" />
          <div className="flex gap-4">
            <div className="flex-1 animate-skeleton rounded-xl h-32" />
            <div className="flex-1 animate-skeleton rounded-xl h-32" />
            <div className="flex-1 animate-skeleton rounded-xl h-32" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
