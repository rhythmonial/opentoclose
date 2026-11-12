import { UploadLessonPage } from "../upload_files/UploadLessonPage";

export default async function UploadYourContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client } = await searchParams;
  return <UploadLessonPage kind="contacts" client={client} />;
}
