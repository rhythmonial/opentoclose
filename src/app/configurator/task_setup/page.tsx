import { loadSetupTasks } from "@/lib/taskSetup";
import { TaskTemplateSetup } from "@/components/TaskSetupTables";
import { loadSetupLesson, SetupShell } from "../_setup/shell";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client } = await searchParams;
  const lesson = await loadSetupLesson("task_setup", client);
  const tasks = lesson.accountId ? await loadSetupTasks(lesson.supabase, lesson.accountId) : [];
  return (
    <SetupShell lesson={lesson} fallbackTitle="Task Template Setup" wide blurb="Every task you're using, grouped by its task template. Download each template's CSV and import it into that task template in Open to Close.">
      <TaskTemplateSetup tasks={tasks} />
    </SetupShell>
  );
}
