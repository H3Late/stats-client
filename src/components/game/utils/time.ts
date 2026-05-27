


export interface DurationObject {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}


export const formatDuration = (seconds: number): DurationObject => {
  const units = [
    { label: 'days',   value: 86400 },
    { label: 'hours',  value: 3600 },
    { label: 'minutes', value: 60 },
    { label: 'seconds', value: 1 },
  ];

  const result = {} as DurationObject;

  for (const { label, value } of units) {
    if (seconds >= value) {
      const amount = Math.floor(seconds / value);
      seconds %= value;
      result[label as keyof DurationObject] = amount;
    }
  }

  return result;

}


export const formatToString = (seconds: number): string => {
  const units = [
    { label: 'day',   value: 86400 },
    { label: 'hour',  value: 3600 },
    { label: 'minute', value: 60 },
    { label: 'second', value: 1 },
  ];

  const result = [];

  for (const { label, value } of units) {
    if (seconds >= value) {
      const amount = Math.floor(seconds / value);
      seconds %= value;
      result.push(`${amount} ${label}${amount !== 1 ? 's' : ''}`);
    }
  }

  return result.length > 0 ? result.join(', ') : '0 seconds';
};