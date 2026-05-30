import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "../../lib/utils";

const rainbowButtonVariants = cva(
  [
    "group relative isolate inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium outline-none transition-all duration-200",
    "focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
    "active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        default: [
          "animate-rainbow text-[var(--rainbow-button-foreground)] shadow-sm shadow-primary/20 hover:-translate-y-px hover:shadow-lg hover:shadow-primary/25",
          "bg-[linear-gradient(var(--rainbow-button-surface),var(--rainbow-button-surface)),linear-gradient(var(--rainbow-button-surface)_50%,rgba(255,255,255,0.55)_80%,rgba(255,255,255,0)),linear-gradient(90deg,var(--rainbow-1),var(--rainbow-5),var(--rainbow-3),var(--rainbow-4),var(--rainbow-2))]",
          "bg-[length:200%] [background-clip:padding-box,border-box,border-box] [background-origin:border-box] [border:calc(0.125rem)_solid_transparent]",
          "before:absolute before:bottom-[-20%] before:left-1/2 before:z-[-1] before:h-1/5 before:w-3/5 before:-translate-x-1/2 before:animate-rainbow before:bg-[linear-gradient(90deg,var(--rainbow-1),var(--rainbow-5),var(--rainbow-3),var(--rainbow-4),var(--rainbow-2))] before:[filter:blur(0.75rem)]",
          "[--rainbow-button-foreground:var(--primary-foreground)] [--rainbow-button-surface:var(--primary)]",
        ],
        outline: [
          "animate-rainbow text-accent-foreground shadow-sm hover:bg-accent/40",
          "bg-[linear-gradient(var(--background),var(--background)),linear-gradient(var(--background)_50%,rgba(255,255,255,0.45)_80%,rgba(255,255,255,0)),linear-gradient(90deg,var(--rainbow-1),var(--rainbow-5),var(--rainbow-3),var(--rainbow-4),var(--rainbow-2))]",
          "bg-[length:200%] [background-clip:padding-box,border-box,border-box] [background-origin:border-box] [border:calc(0.0625rem)_solid_transparent]",
          "before:absolute before:bottom-[-20%] before:left-1/2 before:z-[-1] before:h-1/5 before:w-3/5 before:-translate-x-1/2 before:animate-rainbow before:bg-[linear-gradient(90deg,var(--rainbow-1),var(--rainbow-5),var(--rainbow-3),var(--rainbow-4),var(--rainbow-2))] before:[filter:blur(0.75rem)]",
        ],
      },
      size: {
        default: "h-9 px-4 py-2 text-sm",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-8 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface RainbowButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof rainbowButtonVariants> {
  asChild?: boolean;
}

const RainbowButton = React.forwardRef<HTMLButtonElement, RainbowButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(rainbowButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
RainbowButton.displayName = "RainbowButton";

export { RainbowButton, rainbowButtonVariants };
