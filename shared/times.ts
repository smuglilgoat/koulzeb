/** Every 30-minute time-of-day slot, as zero-padded "HH:MM". */
export const TIME_SLOTS: string[] = Array.from({ length: 48 }, (_, i) => {
  const hours = String(Math.floor(i / 2)).padStart(2, "0");
  const minutes = i % 2 === 0 ? "00" : "30";
  return `${hours}:${minutes}`;
});

export const isTimeSlot = (value: string): boolean =>
  TIME_SLOTS.includes(value);
