// How a new choice option is saved among Field Setup's done items (beside
// the ids of the new fields they've created).
export const optionKey = (fieldId: string, title: string) => `${fieldId}::option::${title}`;
