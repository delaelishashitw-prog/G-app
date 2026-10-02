import React, { useEffect, useState, useRef } from 'react';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  formatNumber?: boolean;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  duration = 900,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
  formatNumber = true,
}) => {
  const [displayValue, setDisplayValue] = useState<number>(0);
  const startValueRef = useRef<number>(0);
  const startTimeRef = useRef<number | null>(null);
  const reqRef = useRef<number | null>(null);

  useEffect(() => {
    const startVal = startValueRef.current;
    const targetVal = value;
    startTimeRef.current = null;

    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setDisplayValue(targetVal);
      startValueRef.current = targetVal;
      return;
    }

    const animateCount = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Smooth cubic-bezier easeOut: 1 - Math.pow(1 - progress, 3)
      const easeOutProgress = 1 - Math.pow(1 - progress, 3);
      const currentVal = startVal + (targetVal - startVal) * easeOutProgress;

      setDisplayValue(currentVal);

      if (progress < 1) {
        reqRef.current = requestAnimationFrame(animateCount);
      } else {
        setDisplayValue(targetVal);
        startValueRef.current = targetVal;
      }
    };

    reqRef.current = requestAnimationFrame(animateCount);

    return () => {
      if (reqRef.current) {
        cancelAnimationFrame(reqRef.current);
      }
    };
  }, [value, duration]);

  const formattedStr = formatNumber
    ? displayValue.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : displayValue.toFixed(decimals);

  return (
    <span className={`inline-block tabular-nums font-feature-settings-tnum ${className}`}>
      {prefix}
      {formattedStr}
      {suffix}
    </span>
  );
};
