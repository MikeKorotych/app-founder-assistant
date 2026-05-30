import { Card, CardContent, CardHeader, CardTitle } from "@hahaton/ui";
import type { ReactNode } from "react";

interface Props {
  step: string;
  title: string;
  description?: string;
  children: ReactNode;
}

export function SectionShell({ step, title, description, children }: Props) {
  return (
    <section className="scroll-mt-10">
      <Card className="border-border/60 bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <CardHeader className="gap-1.5">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Крок · {step}
          </p>
          <CardTitle className="text-xl">{title}</CardTitle>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </section>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <p className="text-sm italic text-muted-foreground">{message}</p>;
}
