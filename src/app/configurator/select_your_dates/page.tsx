import { FieldsPage } from "@/app/configurator/select_otc_fields/FieldsPage";

// Select Your Date Fields: Customize Your Fields' page with just the date and
// number fields, and how each number's days are counted.
export default function SelectYourDatesPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; group?: string }>;
}) {
  return <FieldsPage searchParams={searchParams} mode="dates" />;
}
