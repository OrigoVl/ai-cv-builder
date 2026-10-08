export const cvKeys = {
  list: ["cvs"] as const,
  detail: (id: string) => ["cvs", id] as const,
};
