import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import Icon from './Icon';

const VARIANTS = {
  primary: 'bg-accent text-accent-ink hover:brightness-110 shadow-glow',
  secondary: 'bg-surface-2 text-ink border border-line hover:bg-surface-3',
  ghost: 'text-ink-2 hover:text-ink hover:bg-white/5',
  danger: 'bg-expense-soft text-expense border border-expense/30 hover:bg-expense/20',
};

const SIZES = {
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-xl',
  md: 'h-11 px-4 text-sm gap-2 rounded-2xl',
  lg: 'h-14 px-6 text-base gap-2 rounded-2xl',
  icon: 'h-11 w-11 rounded-2xl',
  'icon-sm': 'h-9 w-9 rounded-xl',
};

const Button = forwardRef(function Button(
  { variant = 'secondary', size = 'md', icon, loading = false, className = '', children, disabled, ...props },
  ref
) {
  return (
    <motion.button
      ref={ref}
      whileTap={disabled || loading ? undefined : { scale: 0.96 }}
      disabled={disabled || loading}
      className={`inline-flex select-none items-center justify-center font-semibold transition-[background,filter,color] disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        icon && <Icon name={icon} size={size === 'lg' ? 20 : 18} />
      )}
      {children}
    </motion.button>
  );
});

export default Button;
