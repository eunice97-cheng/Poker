interface ExitIconProps {
  className?: string
}

export function ExitIcon({ className = 'h-5 w-5' }: ExitIconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9.5 4.75H6.75A2.25 2.25 0 0 0 4.5 7v10A2.25 2.25 0 0 0 6.75 19.25H9.5" />
      <path d="M14.5 8.25 18.25 12l-3.75 3.75" />
      <path d="M18.25 12H9.75" />
    </svg>
  )
}
