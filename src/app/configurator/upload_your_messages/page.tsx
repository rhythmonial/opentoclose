import { UploadLessonPage } from "../upload_files/UploadLessonPage";

export default async function UploadYourMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client } = await searchParams;
  return <UploadLessonPage kind="messages" client={client} />;
}
