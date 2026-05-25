import LeftPanel from "@/components/LeftPanel";
import AdminPermissions from "@/components/AdminPermissions";

export default function AdminPermissionsPage() {
  return (
    <main className="flex-1 w-full">
      <div className="mx-auto max-w-[1280px] px-4 py-5 grid gap-5 grid-cols-[56px_minmax(0,1fr)] lg:grid-cols-[260px_minmax(0,1fr)]">
        <LeftPanel />
        <AdminPermissions />
      </div>
    </main>
  );
}
