import { useCallback } from 'react';
import { ClockSVG } from '../../../../SVGs/Clock';
import { TimerProgress } from '../TimerProgressPopup/TimerProgressPopup';
import { TimerProps as GameTimerProps } from '../../../../../types/game';

type TimerProps = {
  timerProps: GameTimerProps & { isMod?: boolean };
  onTimerUpdate: (timer: GameTimerProps) => void;
};

export const Timer: React.FC<TimerProps> = ({ timerProps, onTimerUpdate }) => {
  const {
    isMod = false,
    timerVisible = false,
    timerPaused = true,
    currentSeconds = 0,
    totalSeconds = 300,
    soundOn = true,
    startedAt = null,
  } = timerProps;

  const onTimerStateUpdate = useCallback(
    (update: GameTimerProps) => {
      onTimerUpdate({ ...update, timerVisible });
    },
    [onTimerUpdate, timerVisible],
  );

  const onTimerClose = useCallback(() => {
    onTimerUpdate({
      currentSeconds: 0,
      totalSeconds: 300,
      soundOn: true,
      timerPaused: true,
      timerVisible: false,
      startedAt: null,
    });
  }, [onTimerUpdate]);

  return (
    <>
      {isMod && (
        <button
          onClick={() =>
            onTimerUpdate({
              currentSeconds: 0,
              totalSeconds: 300,
              soundOn: true,
              timerPaused: true,
              timerVisible: true,
              startedAt: null,
            })
          }
          title='Timer'
          className='cursor-pointer'
        >
          <ClockSVG className={`h-6 w-6 ${timerVisible ? 'text-green-500' : 'text-grey-500'}`} />
        </button>
      )}

      {timerVisible && (
        <TimerProgress
          currentSeconds={currentSeconds}
          totalSeconds={totalSeconds}
          onTimerClose={onTimerClose}
          isMod={isMod}
          onTimerStateUpdate={onTimerStateUpdate}
          soundOn={soundOn}
          timerPaused={timerPaused}
          startedAt={startedAt}
        />
      )}
    </>
  );
};
