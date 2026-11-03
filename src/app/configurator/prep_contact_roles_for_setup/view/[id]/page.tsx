import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ContactFileView } from "@/components/ContactFileView";

// An uploaded contacts file, shown as a table in its own tab (whatever
// format it was uploaded in).
export default async function ViewContactFilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  // Clients only see their own files; staff see any.
  const { data: file } = await supabase
    .from("contact_imports")
    .select("file_name, storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!file) notFound();

  const { data: signed } = await supabase.storage
    .from("contact-files")
    .createSignedUrl(file.storage_path, 60 * 60);
  if (!signed) notFound();

  return (
    <main className="flex flex-1 justify-center bg-bg px-4 py-8">
      <div className="w-full max-w-7xl">
        <ContactFileView url={signed.signedUrl} fileName={file.file_name} />
      </div>
    </main>
  );
}
