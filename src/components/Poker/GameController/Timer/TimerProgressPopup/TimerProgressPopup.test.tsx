import { render, screen, fireEvent, act } from '@testing-library/react';
import { TimerProgress } from './TimerProgressPopup';
import { ComponentProps, useState } from 'react';

jest.mock('../../../../elements/CircularProgressBar', () => ({
  __esModule: true,
  default: ({ percentage, children }: any) => (
    <div data-testid='circular-progress-bar' data-percentage={percentage}>
      {children}
    </div>
  ),
}));

describe('TimerProgress', () => {
  const baseProps = {
    isMod: true,
    currentSeconds: 0,
    totalSeconds: 120,
    soundOn: true,
    timerPaused: true,
    startedAt: null,
    onTimerClose: jest.fn(),
    onTimerStateUpdate: jest.fn(),
  };

  const ControlledTimer = ({
    initial = {},
  }: {
    initial?: Partial<ComponentProps<typeof TimerProgress>>;
  }) => {
    const [state, setState] = useState<ComponentProps<typeof TimerProgress>>({
      ...baseProps,
      ...initial,
    });
    return (
      <TimerProgress
        {...state}
        onTimerStateUpdate={(update) => {
          setState((previous) => ({ ...previous, ...update }));
          baseProps.onTimerStateUpdate(update);
        }}
      />
    );
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-18T02:00:00Z'));
    jest.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('renders timer UI correctly for mod', () => {
    render(<TimerProgress {...baseProps} />);

    expect(screen.getByTitle('Disable sound')).toBeInTheDocument();
    expect(screen.getByTitle('Close Timer')).toBeInTheDocument();
    expect(screen.getByTitle('Start Timer')).toBeInTheDocument();
    expect(screen.getByTitle('Reset Timer')).toBeInTheDocument();
    expect(screen.getByTestId('circular-progress-bar')).toBeInTheDocument();

    // Initial values
    expect(screen.getAllByRole('textbox')[0]).toHaveValue('02');
    expect(screen.getAllByRole('textbox')[1]).toHaveValue('00');
  });

  it('handles sound toggle correctly', () => {
    render(<ControlledTimer />);
    const soundBtn = screen.getByTitle('Disable sound');

    // Initial state
    expect(soundBtn).toHaveTextContent('🔊');

    // Toggle sound
    fireEvent.click(soundBtn);
    expect(screen.getByTitle('Enable sound')).toHaveTextContent('🔇');

    // Toggle back
    fireEvent.click(screen.getByTitle('Enable sound'));
    expect(screen.getByTitle('Disable sound')).toHaveTextContent('🔊');
  });

  it('prevents sound toggle for non-mod', () => {
    render(<TimerProgress {...baseProps} isMod={false} />);
    const soundBtn = screen.getByTitle('Sound Enabled');

    expect(soundBtn).toHaveTextContent('🔊');
    fireEvent.click(soundBtn);
    expect(screen.getByTitle('Sound Enabled')).toHaveTextContent('🔊');
  });

  it('handles timer controls correctly', () => {
    render(<ControlledTimer />);

    // Start timer
    fireEvent.click(screen.getByTitle('Start Timer'));
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByTitle('Pause Timer')).toBeInTheDocument();

    // Pause timer
    fireEvent.click(screen.getByTitle('Pause Timer'));
    expect(screen.getByTitle('Start Timer')).toBeInTheDocument();

    // Reset timer
    fireEvent.click(screen.getByTitle('Reset Timer'));
    expect(screen.getAllByRole('textbox')[0]).toHaveValue('02');
    expect(screen.getAllByRole('textbox')[1]).toHaveValue('00');
  });

  it('updates parent component state correctly', () => {
    render(<ControlledTimer />);

    fireEvent.click(screen.getByTitle('Start Timer'));
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(baseProps.onTimerStateUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        currentSeconds: expect.any(Number),
        totalSeconds: 120,
        timerPaused: false,
        soundOn: true,
      }),
    );
  });

  it('handles input field changes correctly', () => {
    render(<ControlledTimer />);

    const minutesInput = screen.getAllByRole('textbox')[0];
    const secondsInput = screen.getAllByRole('textbox')[1];

    fireEvent.change(minutesInput, { target: { value: '03' } });
    fireEvent.change(secondsInput, { target: { value: '30' } });

    expect(minutesInput).toHaveValue('03');
    expect(secondsInput).toHaveValue('30');
  });

  it('disables controls appropriately', () => {
    render(<ControlledTimer />);

    fireEvent.click(screen.getByTitle('Start Timer'));

    expect(screen.getAllByRole('textbox')[0]).toBeDisabled();
    expect(screen.getAllByRole('textbox')[1]).toBeDisabled();
    expect(screen.queryByTitle('Start Timer')).not.toBeInTheDocument();
  });

  it('never publishes on mount or unchanged snapshot/callback rerenders', () => {
    const { rerender } = render(<TimerProgress {...baseProps} />);
    for (let i = 0; i < 100; i++) {
      rerender(
        <TimerProgress
          {...baseProps}
          onTimerStateUpdate={(update) => baseProps.onTimerStateUpdate(update)}
        />,
      );
    }
    expect(baseProps.onTimerStateUpdate).not.toHaveBeenCalled();
  });

  it('publishes start once and counts down for a minute without more writes', () => {
    render(<ControlledTimer />);
    fireEvent.click(screen.getByTitle('Start Timer'));
    expect(baseProps.onTimerStateUpdate).toHaveBeenCalledTimes(1);
    expect(baseProps.onTimerStateUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ startedAt: Date.now(), timerPaused: false }),
    );
    act(() => {
      jest.advanceTimersByTime(60000);
    });
    expect(screen.getAllByRole('textbox')[0]).toHaveValue('01');
    expect(screen.getAllByRole('textbox')[1]).toHaveValue('00');
    expect(baseProps.onTimerStateUpdate).toHaveBeenCalledTimes(1);
  });

  it('restores the elapsed time when a viewer joins or a moderator reloads', () => {
    const props = {
      ...baseProps,
      timerPaused: false,
      currentSeconds: 15,
      startedAt: Date.now() - 45000,
    };
    const { rerender } = render(<TimerProgress {...props} isMod={false} />);
    expect(screen.getAllByRole('textbox')[0]).toHaveValue('01');
    rerender(<TimerProgress {...props} isMod />);
    expect(screen.getAllByRole('textbox')[0]).toHaveValue('01');
    expect(screen.getByTitle('Pause Timer')).toBeInTheDocument();
    expect(baseProps.onTimerStateUpdate).not.toHaveBeenCalled();
  });

  it('pauses and resumes with the correct elapsed time', () => {
    render(<ControlledTimer />);
    fireEvent.click(screen.getByTitle('Start Timer'));
    act(() => {
      jest.advanceTimersByTime(10000);
    });
    fireEvent.click(screen.getByTitle('Pause Timer'));
    expect(baseProps.onTimerStateUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ currentSeconds: 10, timerPaused: true, startedAt: null }),
    );
    act(() => {
      jest.advanceTimersByTime(20000);
    });
    fireEvent.click(screen.getByTitle('Start Timer'));
    expect(baseProps.onTimerStateUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ currentSeconds: 10, startedAt: Date.now() }),
    );
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    fireEvent.click(screen.getByTitle('Pause Timer'));
    expect(baseProps.onTimerStateUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ currentSeconds: 15 }),
    );
  });

  it('finishes locally without writing completion from every client', () => {
    render(<ControlledTimer initial={{ totalSeconds: 2, soundOn: false }} />);
    fireEvent.click(screen.getByTitle('Start Timer'));
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(screen.getByTitle('Start Timer')).toBeInTheDocument();
    expect(baseProps.onTimerStateUpdate).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTitle('Start Timer'));
    expect(baseProps.onTimerStateUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ currentSeconds: 0, timerPaused: false }),
    );
  });

  it('supports old timer documents without a timestamp without echoing them', () => {
    render(
      <ControlledTimer
        initial={{ timerPaused: false, startedAt: undefined, currentSeconds: 10 }}
      />,
    );
    expect(baseProps.onTimerStateUpdate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTitle('Start Timer'));
    expect(baseProps.onTimerStateUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ currentSeconds: 10, startedAt: Date.now(), timerPaused: false }),
    );
  });

  it('does not write unchanged or invalid duration settings', () => {
    render(<ControlledTimer initial={{ totalSeconds: 60 }} />);
    fireEvent.click(screen.getByTitle('Minus 1 minute'));
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'xx' } });
    expect(baseProps.onTimerStateUpdate).not.toHaveBeenCalled();
  });
});
