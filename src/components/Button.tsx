'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';

type ButtonProps = HTMLMotionProps<'button'> & {
  hoverScale?: number;
  tapScale?: number;
  variant?: 'default' | 'outline' | 'ghost';
};

function Button({
  hoverScale = 1.05,
  tapScale = 0.95,
  variant = 'default',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const variantStyles = {
    default: 'bg-text-p text-black pointer-events-auto',
    outline: 'border border-border bg-inner pointer-events-auto',
    ghost: 'bg-transparent pointer-events-auto',
  };

  return (
    <motion.button
      whileTap={{ scale: tapScale }}
      whileHover={{ scale: hoverScale }}
      className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}

export { Button, type ButtonProps };
