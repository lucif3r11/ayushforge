"use client";

import { useState } from "react";
import { Smartphone, ChevronDown, ChevronUp, Share2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    icon: "🌐",
    text: (
      <>
        Open <strong>Safari</strong> on your iPhone and navigate to this app.
        (Chrome and other browsers do not support PWA install on iOS.)
      </>
    ),
  },
  {
    icon: "⬆️",
    text: (
      <>
        Tap the <strong>Share</strong> button{" "}
        <Share2
          className="inline h-3.5 w-3.5 align-text-bottom"
          strokeWidth={2}
        />{" "}
        at the bottom centre of the screen.
      </>
    ),
  },
  {
    icon: "➕",
    text: (
      <>
        Scroll down in the share sheet and tap{" "}
        <strong>"Add to Home Screen"</strong>.
      </>
    ),
  },
  {
    icon: "✅",
    text: (
      <>
        Confirm the name is <strong>Ironclad</strong> and tap{" "}
        <strong>"Add"</strong>. The app icon will appear on your home screen.
      </>
    ),
  },
] as const;

export default function InstallBanner() {
  const [open, setOpen] = useState(false);

  return (
    <Card className="border-border/60">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-1.5 shrink-0">
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">Add to iPhone Home Screen</p>
            <p className="text-xs text-muted-foreground">
              Install Ironclad as a standalone app
            </p>
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {open && (
        <CardContent className="pt-0 pb-4">
          <div className="rounded-xl bg-muted/40 border border-border/50 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Installation steps
            </p>
            <ol className="space-y-3">
              {STEPS.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="text-base shrink-0 mt-0.5 w-6 text-center">
                    {step.icon}
                  </span>
                  <p className="text-sm text-muted-foreground leading-snug">
                    <span className="text-xs font-bold text-foreground mr-1.5">
                      {i + 1}.
                    </span>
                    {step.text}
                  </p>
                </li>
              ))}
            </ol>
            <div className="mt-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
              <p className="text-xs text-muted-foreground">
                Once installed, Ironclad runs{" "}
                <strong className="text-foreground">fully offline</strong>.
                All your data stays on your device — no cloud, no account needed.
              </p>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
