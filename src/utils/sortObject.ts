export function sortObject<T extends Record<string, any>>(obj: T): T {
  const sorted = {} as T;
  Object.keys(obj)
    .sort()
    .forEach((key) => {
      sorted[key as keyof T] = obj[key];
    });
  return sorted as T;
}
