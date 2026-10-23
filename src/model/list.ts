/** Move `list[from]` into `slot`, where slot i is the gap before item i
 * (slot list.length is the end). Returns the same array when nothing moves. */
export function moveToSlot<T>(list: T[], from: number, slot: number): T[] {
  if (from < 0 || from >= list.length || slot === from || slot === from + 1) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(slot > from ? slot - 1 : slot, 0, item);
  return next;
}
