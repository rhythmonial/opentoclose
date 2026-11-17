import { loadSetupTasks } from "@/lib/taskSetup";
import { TaskTriggerSetup } from "@/components/TaskSetupTables";
import { loadSetupLesson, SetupShell } from "../_setup/shell";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client } = await searchParams;
  const lesson = await loadSetupLesson("task_trigger_setup", client);
  const tasks = lesson.accountId ? await loadSetupTasks(lesson.supabase, lesson.accountId) : [];
  return (
    <SetupShell lesson={lesson} fallbackTitle="Task Trigger Setup" wide blurb="Every task that sends an email, as a trigger. Each starts as send_email when the task is completed, using your default email or text number; change any before you download the CSV for Open to Close.">
      <TaskTriggerSetup tasks={tasks} />
    </SetupShell>
  );
}
