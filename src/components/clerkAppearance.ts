import type { SignIn } from "@clerk/nextjs";
import type { ComponentProps } from "react";

/**
 * Themes Clerk's <SignIn>/<SignUp> into this site's clay look (rounded,
 * soft-inset fields, Fredoka display font) instead of Clerk's own default
 * design, so the auth step doesn't feel like a different product.
 */
export const clerkClayAppearance: ComponentProps<typeof SignIn>["appearance"] = {
  variables: {
    colorPrimary: "#9277EA",
    colorForeground: "#263445",
    colorMutedForeground: "#4A5868",
    colorBackground: "transparent",
    colorInput: "#F5EFE7",
    colorInputForeground: "#263445",
    fontFamily: "var(--font-body)",
    borderRadius: "1.25rem",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full shadow-none bg-transparent",
    card: "w-full p-0 shadow-none bg-transparent",
    header: "hidden",
    footer: "mt-4",
    footerActionText: "text-[color:var(--color-slate)]/75",
    footerActionLink: "font-bold text-[#9277EA] hover:text-[#7a5fd8]",
    socialButtonsBlockButton:
      "rounded-2xl border-0 bg-[#F5EFE7] text-[color:var(--color-slate)] hover:bg-[#EFE7D8] shadow-[inset_4px_4px_9px_rgba(38,52,69,0.09),inset_-4px_-4px_9px_rgba(255,255,255,0.95)]",
    dividerLine: "bg-[color:var(--color-slate)]/10",
    dividerText: "text-[color:var(--color-slate)]/75",
    formFieldLabel: "font-bold text-[color:var(--color-slate)]",
    formFieldInput:
      "rounded-2xl border-0 bg-[#F5EFE7] text-[color:var(--color-slate)] shadow-[inset_4px_4px_9px_rgba(38,52,69,0.09),inset_-4px_-4px_9px_rgba(255,255,255,0.95)] focus:ring-2 focus:ring-[#9277EA]/50",
    formButtonPrimary:
      "rounded-full bg-[linear-gradient(100deg,#9277EA_0%,#EC6FA6_55%,#F0A23A_100%)] text-sm font-bold shadow-[0_16px_30px_-14px_rgba(236,111,166,0.75)] hover:-translate-y-0.5 transition",
    identityPreviewEditButton: "text-[#9277EA]",
    otpCodeFieldInput: "rounded-2xl border-0 bg-[#F5EFE7] shadow-[inset_4px_4px_9px_rgba(38,52,69,0.09)]",
  },
};
