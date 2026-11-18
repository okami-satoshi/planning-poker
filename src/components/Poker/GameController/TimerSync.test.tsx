import { useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GameController } from './GameController';
import { Game, GameType } from '../../../types/game';
import { Status } from '../../../types/status';
import { updateGame } from '../../../service/games';

jest.mock('../../../service/games', () => ({
  updateGame: jest.fn(),
  finishGame: jest.fn(),
  resetGame: jest.fn(),
  removeGame: jest.fn(),
  updateStoryName: jest.fn(),
}));

const initialGame: Game = {
  id: 'game',
  name: 'Timer sync regression',
  createdBy: 'A',
  createdById: 'a',
  createdAt: new Date(),
  average: 0,
  cards: [],
  gameType: GameType.Fibonacci,
  gameStatus: Status.Started,
  isAllowMembersToManageSession: true,
  timerProps: {
    currentSeconds: 0,
    totalSeconds: 300,
    soundOn: false,
    timerPaused: true,
    timerVisible: true,
    startedAt: null,
  },
};
const players = [
  { id: 'a', name: 'A', status: Status.NotStarted },
  { id: 'b', name: 'B', status: Status.NotStarted },
];

function SharedRoom() {
  const [game, setGame] = useState(initialGame);
  (updateGame as jest.Mock).mockImplementation((_id, update) => {
    setGame((previous) => ({ ...previous, ...update }));
    return Promise.resolve(true);
  });
  return (
    <MemoryRouter>
      <section data-testid='moderator-a'>
        <GameController game={game} players={players} currentPlayerId='a' />
      </section>
      <section data-testid='moderator-b'>
        <GameController game={game} players={players} currentPlayerId='b' />
      </section>
    </MemoryRouter>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-11-18T02:00:00Z'));
});
afterEach(() => jest.useRealTimers());

it('two moderators start, count down and pause without echo writes', () => {
  render(<SharedRoom />);
  const a = within(screen.getByTestId('moderator-a'));
  const b = within(screen.getByTestId('moderator-b'));
  expect(updateGame).not.toHaveBeenCalled();
  fireEvent.click(a.getByTitle('Start Timer'));
  expect(updateGame).toHaveBeenCalledTimes(1);
  expect(b.getByTitle('Pause Timer')).toBeInTheDocument();
  act(() => {
    jest.advanceTimersByTime(60000);
  });
  expect(a.getAllByRole('textbox')[0]).toHaveValue('04');
  expect(b.getAllByRole('textbox')[0]).toHaveValue('04');
  expect(updateGame).toHaveBeenCalledTimes(1);
  fireEvent.click(b.getByTitle('Pause Timer'));
  expect(updateGame).toHaveBeenCalledTimes(2);
  expect(updateGame).toHaveBeenLastCalledWith('game', {
    timerProps: expect.objectContaining({ currentSeconds: 60, timerPaused: true, startedAt: null }),
  });
  expect(a.getByTitle('Start Timer')).toBeInTheDocument();
  act(() => {
    jest.advanceTimersByTime(60000);
  });
  expect(updateGame).toHaveBeenCalledTimes(2);
});

it('changing the duration with two moderators writes once and synchronizes both', () => {
  render(<SharedRoom />);
  const a = within(screen.getByTestId('moderator-a'));
  const b = within(screen.getByTestId('moderator-b'));
  fireEvent.click(a.getByTitle('Add 1 minute'));
  expect(updateGame).toHaveBeenCalledTimes(1);
  expect(a.getAllByRole('textbox')[0]).toHaveValue('06');
  expect(b.getAllByRole('textbox')[0]).toHaveValue('06');
  act(() => {
    jest.advanceTimersByTime(60000);
  });
  expect(updateGame).toHaveBeenCalledTimes(1);
});
