export interface GameData {
    left: PlayerObject,
    right: PlayerObject,
    ball: BallObject
};

export function createGameData(
    left: PlayerObject,
    right: PlayerObject,
    ball: BallObject
) : GameData {
    return { left, right, ball };
}

const canvasW = 600;
const canvasH = 400;
const moveValue = 4;


export interface BallObject{
  x: number,
  y: number,
  radius: number,
  speed : number,
  velocityX : number,
  velocityY : number,
};

export interface PlayerObject{
  x: number,
  y: number,
  width : number,
  height: number,
  score: number,
  state: number
};

export function createLeftPlayerObject(
    x: number = 0,
    y: number = canvasH / 2 - 100 / 2,
    width : number = 10,
    height: number = 100,
    score: number = 0,
    state: number = 0
    ): PlayerObject {
  return { x, y, width, height, score, state };
}

export function createRightPlayerObject(
    x: number = canvasW - 10,
    y: number = canvasH / 2 - 100 / 2,
    width : number = 10,
    height: number = 100,
    score: number = 0,
    state: number = 0
    ): PlayerObject {
  return { x, y, width, height, score, state };
}

export function createBallObject(
    x: number = canvasW / 2,
    y: number = canvasH / 2,
    radius: number = 10,
    speed : number = 5,
    velocityX : number = 5,
    velocityY : number = 5,
    ): BallObject {
  return { x, y, radius, speed, velocityX, velocityY };
}










export interface QueueData{
  socketId: string,
  gameType: boolean
};