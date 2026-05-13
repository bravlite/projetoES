// Route group for authenticated pages.
// Guard is enforced by middleware.ts — this layout is a pass-through.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
