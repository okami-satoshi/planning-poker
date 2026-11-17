import { render, screen, fireEvent, act } from '@testing-library/react';
import { TimerProgress } from './TimerProgressPopup';

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
    timerPaused: false,
    onTimerClose: jest.fn(),
    onTimerStateUpdate: jest.fn(),
  };

  beforeEach(() => {
    jest.useFakeTimers();
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
    render(<TimerProgress {...baseProps} />);
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
    render(<TimerProgress {...baseProps} />);

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
    render(<TimerProgress {...baseProps} />);

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
    render(<TimerProgress {...baseProps} />);

    const minutesInput = screen.getAllByRole('textbox')[0];
    const secondsInput = screen.getAllByRole('textbox')[1];

    fireEvent.change(minutesInput, { target: { value: '03' } });
    fireEvent.change(secondsInput, { target: { value: '30' } });

    expect(minutesInput).toHaveValue('03');
    expect(secondsInput).toHaveValue('30');
  });

  it('disables controls appropriately', () => {
    render(<TimerProgress {...baseProps} />);

    fireEvent.click(screen.getByTitle('Start Timer'));

    expect(screen.getAllByRole('textbox')[0]).toBeDisabled();
    expect(screen.getAllByRole('textbox')[1]).toBeDisabled();
    expect(screen.queryByTitle('Start Timer')).not.toBeInTheDocument();
  });

  describe('positioning', () => {
    const originalWidth = window.innerWidth;
    const originalHeight = window.innerHeight;

    const resizeViewport = (width: number, height: number) => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
      fireEvent(window, new Event('resize'));
    };

    const setup = (isMod = true) => {
      render(<TimerProgress {...baseProps} isMod={isMod} />);
      const handle = screen.getByRole('button', { name: 'Move Timer' });
      const popup = handle.parentElement!.parentElement!;
      jest.spyOn(popup, 'getBoundingClientRect').mockReturnValue({
        width: 240,
        height: 300,
      } as DOMRect);
      Object.assign(handle, {
        setPointerCapture: jest.fn(),
        hasPointerCapture: jest.fn(() => true),
        releasePointerCapture: jest.fn(),
      });
      return { handle, popup };
    };

    // JSDOM has no PointerEvent constructor; supply the browser event properties.
    const pointer = (target: HTMLElement, type: string, x: number, y: number, pointerId = 1) =>
      fireEvent(
        target,
        Object.assign(new Event(type, { bubbles: true }), {
          pointerId,
          button: 0,
          clientX: x,
          clientY: y,
        }),
      );

    beforeEach(() => resizeViewport(1024, 768));
    afterEach(() => resizeViewport(originalWidth, originalHeight));

    it('starts fixed to the bottom-right corner', () => {
      const { popup } = setup();
      expect(popup).toHaveClass('fixed');
      expect(popup).toHaveStyle({ right: '16px', bottom: '16px' });
    });

    it('allows each participant to drag without updating shared timer state', () => {
      const { handle, popup } = setup(false);
      baseProps.onTimerStateUpdate.mockClear();
      pointer(handle, 'pointerdown', 900, 600);
      pointer(handle, 'pointermove', 700, 500);
      pointer(handle, 'pointerup', 700, 500);
      expect(popup).toHaveStyle({ right: '216px', bottom: '116px' });
      expect(handle.setPointerCapture).toHaveBeenCalledWith(1);
      expect(handle.releasePointerCapture).toHaveBeenCalledWith(1);
      expect(baseProps.onTimerStateUpdate).not.toHaveBeenCalled();
      pointer(handle, 'pointermove', 500, 400);
      expect(popup).toHaveStyle({ right: '216px', bottom: '116px' });
    });

    it('clamps dragging at all four edges of the viewport', () => {
      const { handle, popup } = setup();
      pointer(handle, 'pointerdown', 900, 600);
      pointer(handle, 'pointermove', -2000, -2000);
      expect(popup).toHaveStyle({ right: '768px', bottom: '452px' });
      pointer(handle, 'pointermove', 2000, 2000);
      expect(popup).toHaveStyle({ right: '16px', bottom: '16px' });
    });

    it('ignores other pointers and stops moving after a cancelled drag', () => {
      const { handle, popup } = setup();
      pointer(handle, 'pointerdown', 900, 600);
      pointer(handle, 'pointermove', 700, 500, 2);
      expect(popup).toHaveStyle({ right: '16px', bottom: '16px' });
      pointer(handle, 'pointercancel', 900, 600);
      pointer(handle, 'pointermove', 700, 500);
      expect(popup).toHaveStyle({ right: '16px', bottom: '16px' });
    });

    it('keeps the popup visible when the viewport shrinks', () => {
      const { handle, popup } = setup();
      pointer(handle, 'pointerdown', 900, 600);
      pointer(handle, 'pointermove', 100, 100);
      pointer(handle, 'pointerup', 100, 100);
      resizeViewport(320, 480);
      expect(popup).toHaveStyle({ right: '64px', bottom: '164px' });
    });

    it('supports keyboard movement while preserving timer controls', () => {
      const { handle, popup } = setup();
      fireEvent.keyDown(handle, { key: 'ArrowLeft' });
      fireEvent.keyDown(handle, { key: 'ArrowUp', shiftKey: true });
      expect(popup).toHaveStyle({ right: '26px', bottom: '66px' });
      fireEvent.click(screen.getByTitle('Start Timer'));
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(screen.getByTitle('Pause Timer')).toBeInTheDocument();
      expect(popup).toHaveStyle({ right: '26px', bottom: '66px' });
    });
  });
});
