"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { Button } from "@/components/ui/button";

/**
 * Two-step destructive button: first click arms it ("Yes, discard?"), second click runs it.
 * Disarms after 4 seconds or on blur. No browser confirm() dialogs.
 */
export function ConfirmButton({
  onConfirm,
  confirmLabel,
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, "onClick"> & { onConfirm: () => void; confirmLabel: string }) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <Button
      {...props}
      variant={armed ? "destructive" : props.variant}
      aria-live="polite"
      onBlur={() => setArmed(false)}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
    >
      {armed ? confirmLabel : children}
    </Button>
  );
}
