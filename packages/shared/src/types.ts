export type HexCoord = { q: number; r: number };

export type PlayerPiece = {
  id: string;
  teamId: 'home' | 'away';
  position: HexCoord;
  pace: number;
  shooting: number;
  tackling: number;
  dribbling: number;
  heading: number;
  saving: number;
  handling: number;
  resilience: number;
  aerialAbility: number;
};

export type BallState = {
  position: HexCoord;
  carrierId: string | null;
};

export type GamePhase =
  | 'LOBBY'
  | 'KICK_OFF'
  | 'MOVEMENT'
  | 'PASS'
  | 'SHOT'
  | 'HEADER'
  | 'SNAPSHOT'
  | 'LOOSE_BALL'
  | 'GK_RESTART'
  | 'HALF_TIME'
  | 'FULL_TIME'
  | 'REPLAY';

export type GameState = {
  roomCode: string;
  phase: GamePhase;
  activeTeam: 'home' | 'away';
  pieces: readonly PlayerPiece[];
  ball: BallState;
  score: { home: number; away: number };
  actionCount: number;
  half: 1 | 2;
  eventLog: readonly unknown[];
};
