import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

export interface ConfirmOptions {
  title: string;
  body?: string;
  cta?: string;
  /** true renders the CTA as a danger button (destructive actions). */
  destructive?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * A single reusable confirm dialog, reused by nearly every primary-action
 * button app-wide (New Lead, Reserve Unit, Record Payment, Approve step,
 * "Create 23 follow-up tasks", …) — mirrors the design's `openConfirmWith`.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(v: boolean) => void>(null);

  const confirm = useCallback<ConfirmFn>((next) => {
    setOpts(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOpts(null);
  }, []);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal
        open={opts != null}
        onOpenChange={(open) => !open && settle(false)}
        title={opts?.title ?? ""}
        description={opts?.body}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => settle(false)}>
              Cancel
            </Button>
            <Button
              variant={opts?.destructive ? "danger" : "primary"}
              size="sm"
              onClick={() => settle(true)}
            >
              {opts?.cta ?? "Confirm"}
            </Button>
          </>
        }
      />
    </ConfirmContext.Provider>
  );
}

/** `const confirm = useConfirm(); if (await confirm({ title, body, cta })) { ... }` */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within <ConfirmProvider>");
  return ctx;
}
