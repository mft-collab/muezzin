import { format } from 'date-fns';
import { useLiveClock } from '../../../hooks/useLiveClock';

export const LiveClockDisplay = () => {
  const time = useLiveClock();
  return <span>{format(time, 'HH:mm:ss')}</span>;
};
