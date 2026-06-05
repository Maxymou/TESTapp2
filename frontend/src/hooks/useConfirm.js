import { useState, useRef, useCallback } from 'react';

export function useConfirm() {
  const [confirmation, setConfirmation] = useState(null);
  const confirmResolverRef = useRef(null);

  const closeConfirmation = useCallback((accepted) => {
    confirmResolverRef.current?.(accepted);
    confirmResolverRef.current = null;
    setConfirmation(null);
  }, []);

  const confirm = useCallback((options) => new Promise((resolve) => {
    confirmResolverRef.current = resolve;
    setConfirmation(options);
  }), []);

  return { confirmation, confirm, closeConfirmation };
}
