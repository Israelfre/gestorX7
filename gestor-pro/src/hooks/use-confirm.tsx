import { useState, useCallback } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmOptions {
  title?: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
}

export function useConfirm() {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions>({ description: "" });
  const [resolve, setResolve] = useState<(v: boolean) => void>(() => () => {});

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((res) => {
      setOpts(options);
      setResolve(() => res);
      setOpen(true);
    });
  }, []);

  const handleConfirm = () => { setOpen(false); resolve(true); };
  const handleCancel = () => { setOpen(false); resolve(false); };

  const ConfirmDialog = (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) handleCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{opts.title ?? "Confirmar"}</AlertDialogTitle>
          <AlertDialogDescription>{opts.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            {opts.cancelText ?? "Cancelar"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className={opts.variant === "destructive" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
          >
            {opts.confirmText ?? "Confirmar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, ConfirmDialog };
}
