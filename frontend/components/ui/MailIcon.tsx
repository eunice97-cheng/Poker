interface MailIconProps {
  className?: string
}

export function MailIcon({ className = 'h-5 w-5' }: MailIconProps) {
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
      <path d="M3.75 7.5A2.25 2.25 0 0 1 6 5.25h12A2.25 2.25 0 0 1 20.25 7.5v9A2.25 2.25 0 0 1 18 18.75H6a2.25 2.25 0 0 1-2.25-2.25v-9Z" />
      <path d="m4.5 7.5 6.73 5.05a1.3 1.3 0 0 0 1.54 0L19.5 7.5" />
    </svg>
  )
}
