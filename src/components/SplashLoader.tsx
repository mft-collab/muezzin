import React from 'react';
import { motion } from 'motion/react';

export const SplashLoader: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 relative overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(79,70,229,0.05),transparent_70%)]" />
      <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none" 
        style={{ 
          backgroundImage: `radial-gradient(#1e293b 1px, transparent 1px)`,
          backgroundSize: '32px 32px'
        }} 
      />
      
      <div className="relative z-10 flex flex-col items-center">
        <div className="relative mb-12">
          {/* Layered orbs */}
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.1, 0.2, 0.1],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -inset-16 bg-indigo-500 rounded-full blur-[60px]"
          />
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.05, 0.15, 0.05],
            }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute -inset-24 bg-blue-400 rounded-full blur-[80px]"
          />
          
          {/* Logo Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-28 h-28 bg-white rounded-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-white flex items-center justify-center overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-white" />
            <div className="relative z-10 flex flex-col items-center">
              <span className="text-4xl font-black text-slate-900 tracking-tighter italic">MT</span>
              <div className="h-0.5 w-4 bg-indigo-500 mt-1 rounded-full" />
            </div>
            
            {/* Animated Scanning Line */}
            <motion.div 
              animate={{ top: ['-10%', '110%'] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
              className="absolute left-0 right-0 h-[2px] bg-indigo-500/10 blur-[2px] z-20"
            />
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col items-center space-y-4"
        >
          <div className="flex flex-col items-center">
            <h1 className="text-sm font-black text-slate-900 uppercase tracking-[0.4em] mb-2 leading-none">MÜEZZİN TAKİP SİSTEMİ</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">VERİ SENKRONİZASYONU VE GÜVENLİK</p>
          </div>

          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{
                  scaleY: [1, 2, 1],
                  backgroundColor: ['#e2e8f0', '#6366f1', '#e2e8f0']
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.15,
                  ease: "easeInOut"
                }}
                className="w-1 h-3 rounded-full"
              />
            ))}
          </div>
        </motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        transition={{ delay: 1 }}
        className="fixed bottom-16 z-10 flex flex-col items-center space-y-3"
      >
        <div className="h-[1px] w-12 bg-slate-200" />
        <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-slate-400">PROTOKOL 4.2.1 • GÜVENLİ BAĞLANTI</p>
      </motion.div>
    </div>
  );
};
