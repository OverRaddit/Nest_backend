import { Socket } from 'socket.io';

export interface GameData {
  left: PlayerObject,
  right: PlayerObject,
  ball: BallObject,
  type: GameType
};

export function createGameData(
  left: PlayerObject,
  right: PlayerObject,
  ball: BallObject,
  type: GameType,
): GameData {
  return { left, right, ball, type };
}

const canvasW = 600;
const canvasH = 400;
const moveValue = 4;

export interface GameType {
flag: number;
};

export interface BallObject {
x: number;
y: number;
radius: number;
speed: number;
velocityX: number;
velocityY: number;
};

export interface PlayerObject {
x: number;
y: number;
width: number;
height: number;
score: number;
state: number;
nick: string;
};

export function createGameType(
flag = 0
): GameType {
return {flag};
}

export function createLeftPlayerObject({
  x = 0,
  y = canvasH / 2 - 100 / 2,
  width = 10,
  height = 100,
  score = 0,
  state = 0,
  nick = '',
}): PlayerObject {
return { x, y, width, height, score, state, nick };
}

export function createRightPlayerObject({
  x = canvasW - 10,
  y = canvasH / 2 - 100 / 2,
  width = 10,
  height = 100,
  score = 0,
  state = 0,
  nick = '',
}): PlayerObject {
return { x, y, width, height, score, state, nick };
}

export function createBallObject(
  x = canvasW / 2,
  y = canvasH / 2,
  radius = 10,
  speed = 5,
  velocityX = 5,
  velocityY = 5,
  ): BallObject {
return { x, y, radius, speed, velocityX, velocityY };
}

export interface SocketInfo {
  roomName: string,
  playerId: number
};

export interface QueueObject{
  socket: Socket,
  gameType: MapStatus
  nickName: string
};

export enum ExitStatus {
  CRASH = 0,
  GRACEFUL_SHUTDOWN = 1,
}

export enum MapStatus {
  NORMAL = 0,
  EXTENDED = 1,
}