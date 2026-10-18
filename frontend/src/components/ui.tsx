// Building blocks of the design guide (guidelines/README.md, css/components.css for sizes and states).
// Colours come only from the guide's tokens, so both themes work without dark: variants.

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "lg" | "md";

const buttonBase =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 [&>svg]:size-3.5";

const buttonVariants: Record<ButtonVariant, string> = {
  // The one most important action of a view.
  primary: "border border-action bg-action font-semibold text-on-action hover:border-action-hover hover:bg-action-hover",
  secondary: "border border-border bg-surface text-ink hover:bg-page [&>svg]:text-muted",
  // Destructive action as a ghost button.
  danger: "border border-transparent text-danger hover:bg-danger-bg",
  ghost: "border border-transparent text-ink-secondary hover:bg-divider [&>svg]:text-muted",
};

const buttonSizes: Record<ButtonSize, string> = {
  lg: "h-9 px-3.5 text-[13px]",
  md: "h-8 px-2.5 text-xs",
};

// Classes rather than a component, so links and file-input labels can look like buttons too.
export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "lg"): string {
  return `${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]}`;
}

export const inputClass =
  "h-9 w-full min-w-0 rounded-md border border-input bg-surface px-3 text-[14px] text-ink placeholder:text-subtle focus:border-primary focus:shadow-[0_0_0_2px_var(--ds-primary-tint-20)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";

export function PageHeader({
  title,
  lead,
  actions,
}: {
  title: string;
  lead?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl leading-8 font-semibold tracking-[-0.02em] break-words">{title}</h1>
        {lead && <p className="mt-1 text-muted">{lead}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

// A bordered surface. "main" panels sit in the main area, "rail" panels in the right column.
export function Panel({
  title,
  sub,
  actions,
  variant = "main",
  flush = false,
  children,
  className = "",
}: {
  title?: string;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
  variant?: "main" | "rail";
  // Content reaches the edges, e.g. a table or list with its own padding.
  flush?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const rail = variant === "rail";
  const padX = rail ? "px-5" : "px-5 sm:px-6";
  return (
    <section className={`rounded-lg border border-border bg-surface ${className}`}>
      {title && (
        <div className={`flex items-start justify-between gap-4 ${padX} ${rail ? "pt-5 pb-3" : "pt-5 pb-4"}`}>
          <div className="min-w-0">
            <h2 className={rail ? "text-sm leading-5 font-semibold" : "text-base leading-6 font-semibold"}>{title}</h2>
            {sub && <p className={`text-muted ${rail ? "text-xs" : "text-[13px]"}`}>{sub}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={flush ? "" : `${padX} ${rail ? "pb-5" : "pb-6"} ${title ? "" : rail ? "pt-5" : "pt-6"}`}>
        {children}
      </div>
    </section>
  );
}

type BadgeTone = "neutral" | "primary" | "success" | "info" | "warning" | "danger";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-status-neutral-bg text-ink-tertiary",
  primary: "bg-primary-tint-10 text-primary",
  success: "bg-success-bg text-success-strong",
  info: "bg-info-bg text-info",
  warning: "bg-warning-bg text-warning-strong",
  danger: "bg-danger-bg text-danger",
};

// Always carries a word, never colour alone.
export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] leading-[1.5] font-medium whitespace-nowrap ${badgeTones[tone]}`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-md border border-danger/30 bg-danger-bg px-3 py-2 text-danger">
      {children}
    </p>
  );
}

// Uppercase small label for column heads, KPI labels and group headings.
export const captionCaps = "text-[11px] font-medium tracking-[0.06em] text-muted uppercase";
