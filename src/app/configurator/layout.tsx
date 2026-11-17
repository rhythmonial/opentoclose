import { AppHeader } from "@/components/AppHeader";

// Every page here gets the app's header.
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <AppHeader />
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
