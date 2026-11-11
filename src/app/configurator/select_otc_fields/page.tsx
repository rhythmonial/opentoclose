import { FieldsPage } from "./FieldsPage";

// Customize Your Fields.
export default function SelectOtcFieldsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; group?: string }>;
}) {
  return <FieldsPage searchParams={searchParams} mode="fields" />;
}
