import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from "react";

export type ButtonVariant =
  | "primary"
  | "soft"
  | "ghost"
  | "quiet"
  | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly icon?: ReactNode;
}

export function Button({
  variant = "soft",
  icon,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={[
        "ui-button",
        "ui-button--" + variant,
        icon ? "has-icon" : "",
        className,
      ].filter(Boolean).join(" ")}
    >
      {icon ? <span className="ui-button__icon" aria-hidden="true">{icon}</span> : null}
      <span className="ui-button__label">{children}</span>
    </button>
  );
}

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  readonly tone?: "surface" | "blue" | "yellow" | "pink" | "sage";
}

export function Card({
  tone = "surface",
  className = "",
  ...props
}: CardProps) {
  return (
    <div
      {...props}
      className={["ui-card", "ui-card--" + tone, className]
        .filter(Boolean)
        .join(" ")}
    />
  );
}

export interface PanelProps extends HTMLAttributes<HTMLElement> {
  readonly tone?: "surface" | "blue" | "yellow" | "pink" | "sage";
}

export function Panel({
  tone = "surface",
  className = "",
  ...props
}: PanelProps) {
  return (
    <section
      {...props}
      className={["ui-panel", "ui-panel--" + tone, className]
        .filter(Boolean)
        .join(" ")}
    />
  );
}

export interface ProgressBarProps {
  readonly value: number;
  readonly tone?: "primary" | "yellow" | "blue" | "pink";
  readonly label: string;
}

export function ProgressBar({
  value,
  tone = "primary",
  label,
}: ProgressBarProps) {
  const safeValue = Number.isFinite(value)
    ? Math.min(100, Math.max(0, value))
    : 0;
  return (
    <div
      className={"ui-progress ui-progress--" + tone}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(safeValue)}
    >
      <span className="ui-progress__track">
        <span
          className="ui-progress__value"
          style={{ width: safeValue + "%" }}
        />
      </span>
    </div>
  );
}

export function StatusChip({
  children,
  tone = "primary",
}: {
  readonly children: ReactNode;
  readonly tone?: "primary" | "yellow" | "blue" | "pink";
}) {
  return <span className={"ui-status-chip ui-status-chip--" + tone}>{children}</span>;
}

export function PanelHeader({
  title,
  subtitle,
  onClose,
  closeLabel = "关闭面板",
}: {
  readonly title: string;
  readonly subtitle?: string;
  readonly onClose: () => void;
  readonly closeLabel?: string;
}) {
  return (
    <header className="ui-panel-header">
      <div className="ui-panel-header__copy">
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <Button
        className="ui-panel-header__close"
        variant="quiet"
        type="button"
        aria-label={closeLabel}
        onClick={onClose}
      >
        ×
      </Button>
    </header>
  );
}

export function Divider() {
  return <div className="ui-divider" role="presentation" />;
}

export function Popover({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={["ui-popover", className].filter(Boolean).join(" ")}
    >
      {children}
    </div>
  );
}
