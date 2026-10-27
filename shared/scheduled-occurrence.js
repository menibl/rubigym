// Retain cancelled records/registrations for history, but never offer them again.
export const isCancelledOccurrence = (item, date = item?.date) => Boolean(date && item?.excludedDates?.includes(date));
