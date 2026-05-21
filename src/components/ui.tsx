import type { ReactNode } from "react"

import { clsx } from "clsx"

export function Button(props: {
  children: ReactNode
  onClick?: () => void
  type?: "button" | "submit"
  variant?: "primary" | "secondary" | "ghost" | "danger"
  disabled?: boolean
  className?: string
  title?: string
}) {
  const variant = props.variant ?? "secondary"

  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-zinc-100 text-graphite-950 hover:bg-white",
        variant === "secondary" &&
          "border border-white/10 bg-white/[0.04] text-zinc-100 hover:bg-white/[0.08]",
        variant === "ghost" && "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100",
        variant === "danger" &&
          "border border-signal-red/30 bg-signal-red/10 text-signal-red hover:bg-signal-red/15",
        props.className
      )}
      disabled={props.disabled}
      onClick={props.onClick}
      title={props.title}
      type={props.type ?? "button"}>
      {props.children}
    </button>
  )
}

export function Panel(props: { children: ReactNode; className?: string }) {
  return (
    <section
      className={clsx(
        "rounded-lg border border-white/10 bg-graphite-900 shadow-panel",
        props.className
      )}>
      {props.children}
    </section>
  )
}

export function Field(props: {
  label: string
  children: ReactNode
  hint?: string
  className?: string
}) {
  return (
    <label className={clsx("block", props.className)}>
      <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
        {props.label}
      </span>
      <div className="mt-2">{props.children}</div>
      {props.hint ? (
        <p className="mt-1 text-xs leading-5 text-zinc-500">{props.hint}</p>
      ) : null}
    </label>
  )
}

export function TextInput(props: {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  max?: number
  min?: number
  placeholder?: string
  step?: number
  type?: string
}) {
  return (
    <input
      className="w-full rounded-md border border-white/10 bg-graphite-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
      max={props.max}
      min={props.min}
      onBlur={props.onBlur}
      onChange={(event) => props.onChange(event.currentTarget.value)}
      placeholder={props.placeholder}
      step={props.step}
      type={props.type ?? "text"}
      value={props.value}
    />
  )
}

export function SelectInput<T extends string>(props: {
  value: T
  onChange: (value: T) => void
  children: ReactNode
}) {
  return (
    <select
      className="w-full rounded-md border border-white/10 bg-graphite-950 px-3 py-2 text-sm text-zinc-100"
      onChange={(event) => props.onChange(event.currentTarget.value as T)}
      value={props.value}>
      {props.children}
    </select>
  )
}

export function TextArea(props: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <textarea
      className="w-full resize-none rounded-md border border-white/10 bg-graphite-950 px-3 py-2 text-sm leading-6 text-zinc-100 placeholder:text-zinc-600"
      onChange={(event) => props.onChange(event.currentTarget.value)}
      placeholder={props.placeholder}
      rows={props.rows ?? 4}
      value={props.value}
    />
  )
}

export function Toggle(props: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <button
      className="flex w-full items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-sm"
      onClick={() => props.onChange(!props.checked)}
      type="button">
      <span className="text-zinc-200">{props.label}</span>
      <span
        className={clsx(
          "flex h-5 w-9 items-center rounded-full p-0.5 transition",
          props.checked ? "bg-signal-green" : "bg-zinc-700"
        )}>
        <span
          className={clsx(
            "h-4 w-4 rounded-full bg-graphite-950 transition",
            props.checked && "translate-x-4"
          )}
        />
      </span>
    </button>
  )
}

export function ScorePill(props: {
  label: string
  value: number
  tone?: "green" | "amber" | "blue" | "red"
}) {
  const tone = props.tone ?? "blue"

  return (
    <div className="rounded-md border border-white/10 bg-white/[0.035] px-3 py-2">
      <p className="text-xs text-zinc-500">{props.label}</p>
      <p
        className={clsx(
          "mt-1 text-lg font-semibold",
          tone === "green" && "text-signal-green",
          tone === "amber" && "text-signal-amber",
          tone === "blue" && "text-signal-blue",
          tone === "red" && "text-signal-red"
        )}>
        {props.value}
      </p>
    </div>
  )
}

export function EmptyState(props: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/15 p-8 text-center">
      <p className="font-medium text-zinc-200">{props.title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-500">
        {props.body}
      </p>
    </div>
  )
}
