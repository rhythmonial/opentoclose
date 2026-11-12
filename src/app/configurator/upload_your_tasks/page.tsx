import { UploadLessonPage } from "../upload_files/UploadLessonPage";

export default async function UploadYourTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client } = await searchParams;
  return <UploadLessonPage kind="tasks" client={client} />;
}
