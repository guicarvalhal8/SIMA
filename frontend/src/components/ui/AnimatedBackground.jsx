import React from 'react';
import { motion } from 'framer-motion';

export function AnimatedBackground({ variant = 'default' }) {
    const orbs = variant === 'login' ? [
        { size: 520, x: '8%', y: '14%', color: 'rgba(11, 87, 208, 0.12)', duration: 22 },
        { size: 360, x: '72%', y: '12%', color: 'rgba(106, 27, 255, 0.12)', duration: 26 },
        { size: 420, x: '58%', y: '72%', color: 'rgba(0, 59, 143, 0.1)', duration: 24 },
        { size: 280, x: '22%', y: '78%', color: 'rgba(124, 58, 237, 0.1)', duration: 20 },
    ] : [
        { size: 420, x: '4%', y: '10%', color: 'rgba(11, 87, 208, 0.08)', duration: 28 },
        { size: 320, x: '74%', y: '18%', color: 'rgba(106, 27, 255, 0.08)', duration: 32 },
        { size: 260, x: '64%', y: '76%', color: 'rgba(0, 59, 143, 0.07)', duration: 30 },
    ];

    return (
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
            <div className="absolute inset-0 grid-pattern opacity-70" />

            {orbs.map((orb, index) => (
                <motion.div
                    key={index}
                    className="absolute rounded-full"
                    style={{
                        width: orb.size,
                        height: orb.size,
                        left: orb.x,
                        top: orb.y,
                        background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
                        filter: 'blur(42px)',
                    }}
                    animate={{
                        x: [0, 28, -18, 0],
                        y: [0, -20, 14, 0],
                        scale: [1, 1.08, 0.96, 1],
                    }}
                    transition={{
                        duration: orb.duration,
                        repeat: Infinity,
                        ease: 'easeInOut',
                    }}
                />
            ))}

            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0))]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.8),transparent_54%)]" />
        </div>
    );
}
