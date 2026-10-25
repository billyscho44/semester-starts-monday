import Nav from "@/components/Nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Covers the phone's status bar area so scrolled content does not show behind the clock */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-40 bg-bg" style={{ height: "env(safe-area-inset-top)" }} />
      <div className="flex flex-1 flex-col pb-24">{children}</div>
      <Nav />
    </>
  );
}
