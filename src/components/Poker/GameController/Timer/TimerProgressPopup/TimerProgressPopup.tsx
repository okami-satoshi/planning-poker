import { ChangeEvent, useEffect, useRef, useState } from 'react';
import CircularProgressBar from '../../../../elements/CircularProgressBar';
import { useTranslation } from 'react-i18next';
import { TimerProps as GameTimerProps } from '../../../../../types/game';

type TimerProps = GameTimerProps & {
  isMod?: boolean;
  onTimerClose: () => void;
  onTimerStateUpdate: (update: GameTimerProps) => void;
};

const getMinutesAndSeconds = (time: number) => [Math.floor(time / 60), time % 60];

const audio = typeof Audio !== 'undefined' ? new Audio('/timer-notification.mp3') : null;

export const TimerProgress: React.FC<TimerProps> = ({
  currentSeconds = 0,
  totalSeconds = 300,
  onTimerClose,
  isMod,
  onTimerStateUpdate,
  soundOn = true,
  timerPaused = true,
  startedAt = null,
}) => {
  const [now, setNow] = useState(Date.now);
  const wasRunning = useRef(false);
  const total = totalSeconds;
  // Old sessions without a start timestamp remain readable and can be resumed.
  const hasStartTime = typeof startedAt === 'number' && Number.isFinite(startedAt);
  const getCurrent = (time: number) =>
    Math.min(
      total,
      Math.max(
        0,
        currentSeconds +
          (!timerPaused && hasStartTime ? Math.floor(Math.max(0, time - startedAt!) / 1000) : 0),
      ),
    );
  const current = getCurrent(now);
  const inProgress = !timerPaused && hasStartTime && current < total;

  const { t } = useTranslation();

  useEffect(() => {
    if (!inProgress) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [inProgress, startedAt]);

  useEffect(() => {
    if (wasRunning.current && !inProgress && current >= total && total > 0 && soundOn && isMod) {
      audio?.play()?.catch(() => {});
    }
    wasRunning.current = inProgress;
  }, [inProgress, current, total, soundOn, isMod]);

  // Only explicit user actions publish shared state. Receiving a snapshot or
  // ticking the display must never cause another database write.
  const publish = (update: GameTimerProps) => {
    if (!isMod) return;
    onTimerStateUpdate({
      currentSeconds,
      totalSeconds,
      soundOn,
      timerPaused,
      startedAt,
      ...update,
    });
  };
  const startTimer = () => {
    const elapsed = getCurrent(Date.now());
    publish({
      currentSeconds: elapsed >= total ? 0 : elapsed,
      timerPaused: false,
      startedAt: Date.now(),
    });
  };
  const pauseTimer = () =>
    publish({ currentSeconds: getCurrent(Date.now()), timerPaused: true, startedAt: null });
  const handleReset = () => publish({ currentSeconds: 0, timerPaused: true, startedAt: null });
  const setDuration = (seconds: number, reset = false) => {
    if (!Number.isFinite(seconds) || seconds < 0 || seconds === total) return;
    publish({
      totalSeconds: seconds,
      currentSeconds: reset ? 0 : getCurrent(Date.now()),
      timerPaused: true,
      startedAt: null,
    });
  };
  const onAddSeconds = () => setDuration(total + 60);
  const onReduceSeconds = () => {
    if (total - 60 > 30) setDuration(total - 60);
  };
  const onMinutesChange = (event: ChangeEvent<HTMLInputElement>) =>
    setDuration(Number(event.target.value.slice(-2)) * 60 + (total % 60), true);
  const onSecondsChange = (event: ChangeEvent<HTMLInputElement>) =>
    setDuration(Math.floor(total / 60) * 60 + Number(event.target.value.slice(-2)), true);

  const [minutes, seconds] = getMinutesAndSeconds(total);
  const [runningMinutes, runningSeconds] = getMinutesAndSeconds(total - current);
  const percentage = total > 0 ? 100 - (current / total) * 100 : 100;
  const [currentMinutesRunning, currentSecondsRunning] = getMinutesAndSeconds(current);

  return (
    <div className='fixed bottom-4 right-4 shadow-xl rounded-lg bg-white p-4 w-[15rem] h-fit border-gray-200 border-1 dark:bg-gray-800 dark:border-gray-700 z-10'>
      <button
        title={
          soundOn
            ? isMod
              ? t('GameController.Timer.soundEnabledMod')
              : t('GameController.Timer.soundEnabledPlayer')
            : isMod
            ? t('GameController.Timer.soundDisabledMod')
            : t('GameController.Timer.soundDisabledPlayer')
        }
        className={`absolute top-3 left-3 p-1 ${isMod ? 'cursor-pointer' : ''}`}
        onClick={() => publish({ soundOn: !soundOn })}
        type='button'
      >
        {soundOn ? '🔊' : '🔇'}
      </button>
      {isMod && (
        <div
          className='absolute top-3 right-3 cursor-pointer'
          title={t('GameController.Timer.closeTimer')}
          onClick={onTimerClose}
        >
          X
        </div>
      )}
      <div className='flex h-full w-full justify-center items-center space-y-2 flex-col'>
        <CircularProgressBar percentage={percentage}>
          <div className='text-4xl flex flex-col items-center space-y-2'>
            <div
              title={
                isMod
                  ? `Set Time: ${minutes} Minutes, ${seconds} Seconds.\nReset to edit`
                  : `Running Time: ${runningMinutes} Minutes, ${runningSeconds} Seconds.`
              }
              className='flex items-center space-x-1 flex-grow dark:text-white'
            >
              <input
                type='text'
                value={
                  inProgress || !isMod
                    ? runningMinutes.toString().padStart(2, '0')
                    : minutes.toString().padStart(2, '0')
                }
                maxLength={3}
                pattern='[0-9]*'
                className='w-[2.5rem] border-none focus:outline-none'
                onChange={onMinutesChange}
                disabled={inProgress || !isMod}
              />
              <span className='pb-[0.3rem]'>:</span>
              <input
                type='text'
                value={
                  inProgress || !isMod
                    ? runningSeconds.toString().padStart(2, '0')
                    : seconds.toString().padStart(2, '0')
                }
                maxLength={3}
                pattern='[0-9]*'
                className='w-[2.5rem] border-none focus:outline-none'
                onChange={onSecondsChange}
                disabled={inProgress || !isMod}
              />
            </div>
            {isMod && !inProgress && (
              <div
                title={`Running Time: ${currentMinutesRunning} Minutes, ${currentSecondsRunning} Seconds.`}
                className='text-2xl dark:text-white'
              >
                <span>{currentMinutesRunning.toString().padStart(2, '0')}</span>
                <span>:</span>
                <span>{currentSecondsRunning.toString().padStart(2, '0')}</span>
              </div>
            )}
          </div>
        </CircularProgressBar>
        {isMod && (
          <>
            <hr className='h-px my-3 bg-gray-200 border-0 dark:bg-gray-700 w-full' />
            <div className='flex space-x-2 w-full'>
              <TimerControlButton
                title={t('GameController.Timer.resetTimer')}
                callback={handleReset}
                className='text-gray-400'
              >
                {'\u23F9'}
              </TimerControlButton>
              <div className='flex-grow w-full'>
                {!inProgress && (
                  <div className='flex justify-center items-center gap-x-2 w-full h-8' role='group'>
                    <TimerControlButton callback={onReduceSeconds} title='Minus 1 minute'>
                      -
                    </TimerControlButton>
                    <TimerControlButton callback={onAddSeconds} title='Add 1 minute'>
                      +
                    </TimerControlButton>
                  </div>
                )}
              </div>
              {!inProgress && (
                <TimerControlButton
                  title={t('GameController.Timer.startTimer')}
                  callback={startTimer}
                  disabled={total === 0}
                  className='text-gray-400'
                >
                  {'\u25B6'}
                </TimerControlButton>
              )}
              {inProgress && (
                <TimerControlButton
                  title={t('GameController.Timer.pauseTimer')}
                  callback={pauseTimer}
                  className='text-gray-400'
                >
                  {'\u23F8'}
                </TimerControlButton>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

type TimerControlButtonProps = {
  title: string;
  callback: () => void;
  children?: React.ReactNode;
  disabled?: boolean;
  className?: string;
};

export const TimerControlButton: React.FC<TimerControlButtonProps> = ({
  title,
  callback,
  children,
  disabled = false,
  className = '',
}) => {
  return (
    <button
      title={title}
      className={`p-2 border-2 border-gray-200 h-8 w-8 flex items-center justify-center text-xl hover:text-gray-600 hover:border-gray-600 pb-[0.7rem] ${className} dark:border-gray-700 dark:hover:border-gray-500 dark:hover:text-gray-300`}
      onClick={callback}
      type='button'
      disabled={disabled}
    >
      {children}
    </button>
  );
};
