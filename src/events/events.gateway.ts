import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { randomBytes } from 'crypto';
import { join } from 'path';
import { Server, Socket } from 'socket.io';
import { GameData, BallObject, PlayerObject, QueueData, createBallObject, createLeftPlayerObject, createRightPlayerObject, createGameData } from './game.interface';

// 이 설정들이 뭘하는건지, 애초에 무슨 레포를 보고 이것들을 찾을 수 있는지 전혀 모르겠다.
@WebSocketGateway(8000, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    transports: ['websocket', 'polling'],
    credentials: true,
  },
})

export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect // 무조건 만들어야 에러가 안나게 하는부분인가봄.
{
  @WebSocketServer()
  server: Server;

  // private intervalId: NodeJS.Timeout;
  private canvasW = 600;
  private canvasH = 400;
  private moveValue = 4;
  // add
  private ball: BallObject = createBallObject();

  private leftUser: PlayerObject = createLeftPlayerObject
  (0, this.canvasH / 2 - 100 / 2, 10, 100, 0, 0);
  private rightUser: PlayerObject = createRightPlayerObject
  (this.canvasW - 10,this.canvasH / 2 - 100 / 2, 10, 100,0,0);

  private gameRoom = {};
  // private sock = {};

  private intervalIds = {};


  // socketIO server가 처음 켜질(init)될때 동작하는 함수 - OnGatewayInit 짝궁
  // setTimeout(() => console.log("after"), 3000);

  //startGame이 시작된다면

  private GameObject = {
    left: this.leftUser,
    right: this.rightUser,
    ball: this.ball
  }

  startGame(roomId: string) {
    console.log(roomId);
    function collision(b, p)
    {
      b.top = b.y - b.radius;
      b.bottom = b.y + b.radius;
      b.left = b.x - b.radius;
      b.right = b.x + b.radius;

      p.top = p.y;
      p.bottom = p.y + p.height;
      p.left = p.x;
      p.right = p.x + p.width;
      return b.right > p.left && b.bottom > p.top && 
              b.left < p.right && b.top < p.bottom;
    }

    function resetBall(ball, w, h) {
      // console.log(ball, w,h);
      ball.x = w / 2;
      ball.y = h / 2;
  
      ball.speed = 5;
      ball.velocityX = ball.velocityX; 
      return ball;
    }
    const setId = setInterval(() => {
      const data = this.gameRoom[roomId];
      

      // 40ms마다 실행되는 로직 작성

      data.ball.x += data.ball.velocityX;
      data.ball.y += data.ball.velocityY;
  
      if (data.ball.y + data.ball.radius > this.canvasH ||
        data.ball.y - data.ball.radius < 0) {
        data.ball.velocityY = -data.ball.velocityY;
      }
      // console.log(data.left, data.right);
      let player = (data.ball.x < this.canvasW / 2) ? data.left : data.right;
      // console.log(data.ball.x, data.ball.y, player.x, player.y);
      if (collision(data.ball, player))
      {
        let collidePoint = data.ball.y - (player.y + player.height / 2);
        collidePoint = collidePoint / (player.height / 2);

        let angleRad = collidePoint * Math.PI / 4;
        let direction = (data.ball.x < this.canvasW /  2) ? 1 : -1;
        data.ball.velocityX = direction *  data.ball.speed * Math.cos(angleRad);
        data.ball.velocityY =              data.ball.speed * Math.sin(angleRad);

        data.ball.speed += 0.1;
      }

      // update paddle
      // console.log(data.left.state, data.right.state)
      if (data.left.state == 1) {
        data.left.y = Math.max(data.left.y - this.moveValue, 0);
        // console.log(data.left.y, data.left.x, data.right.y, data.right.x)
      }
      else if (data.left.state == 2) {
        data.left.y = Math.min(data.left.y + this.moveValue, this.canvasH - data.left.height);
        // console.log(data.left.y, data.left.x, data.right.y, data.right.x)
      }
      if (data.right.state == 1) {
        data.right.y = Math.max(data.right.y - this.moveValue, 0);
        // console.log(data.left.y, data.left.x, data.right.y, data.right.x)
      }
      else if (data.right.state == 2) {
        data.right.y = Math.min(data.right.y + this.moveValue, this.canvasH - data.right.height);
        // console.log(data.left.y, data.left.x, data.right.y, data.right.x)
      }
      

      // update the score
      if (data.ball.x - data.ball.radius < 0)
      {
        data.right.score++;
        this.isGameOver(data.left.score, data.right.score, roomId);
        data.ball = resetBall(data.ball, this.canvasW, this.canvasH);
      } 
      else if (data.ball.x + data.ball.radius > this.canvasW){
        data.left.score++;
        this.isGameOver(data.left.score, data.right.score, roomId);
        data.ball = resetBall(data.ball, this.canvasW, this.canvasH);
      }

      this.server.to(roomId).emit('render', data.left, data.right, data.ball, roomId);
      // 40ms마다 실행되는 로직 작성
      // ex) 게임 프레임 처리
    }, 50);
    console.log("Set Id:", setId);
    this.intervalIds[roomId] = setId;
  }

  afterInit(server: Server) {
      

    console.log('WebSocketGateway initialized');
    
  }

  // 연결된 socket이 연결될때 동작하는 함수 - OnGatewayConnection 짝궁
  handleConnection(client: any, ...args: any[]) {

    // console.log("testsetsetset");
    console.log(`Client connected: ${client.id}`);
  }

  // 연결된 socket이 끊어질때 동작하는 함수 - OnGatewayDisconnect 짝궁
  handleDisconnect() {
    console.log('WebSocketGateway disconnected');
  }

  /*
  // socket의 메시지를 room내부의 모든 이들에게 전달합니다.
  @SubscribeMessage('chat')
  async handleChat(@ConnectedSocket() client, @MessageBody() data) {
    console.log('chat: ', data);
    client.to('gshim').emit('chat', data);
  }

  // socket을 특정 room에 join 시킵니다.
  // data에서 방 이름을 가져와야 할 듯?
  @SubscribeMessage('join')
  async handleJoin(@ConnectedSocket() client, @MessageBody() data) {
    client.join('gshim');
    const gshimNum = this.server.sockets.adapter.rooms.get('gshim').size;
    console.log('clientId: ', client.id, 'join to room gshim');
    console.log(
      `현재 게임룸 현황(${gshimNum}): ${this.server.sockets.adapter.rooms.get(
        'gshim',
      )}`,
    );
    // join한 socket에게 본인이 왼쪽플레이어인지 오른쪽플레이어인지 알려준다.
    this.server.to(client.id).emit('isLeft', gshimNum); // TODO
  }*/

  // 여기서부터 게임이벤트 =====================================
  @SubscribeMessage('handleKeyPressUp')
  async handleKeyPressUp(
    @ConnectedSocket() client,
    @MessageBody() message,
  ) {
    const [room, id] = message;
    if (id === 1)
    {
      this.gameRoom[room].left.state = 1;
      console.log(this.gameRoom[room].left);
    }
    else if (id === 2)
    {
      this.gameRoom[room].right.state = 1;
      console.log(this.gameRoom[room].right);
    }
    
  }

  @SubscribeMessage('handleKeyPressDown')
  async handleKeyPressDown(
    @ConnectedSocket() client,
    @MessageBody() data
  ) {
    const [room, id] = data;
    // console.log(client.id);
    console.log(room, id);
    // console.log(this.gameRoom[room]);
    if (id === 1)
    {
      this.gameRoom[room].left.state = 2;
      console.log(this.gameRoom[room].left);
    }
    else if (id === 2)
    {
      this.gameRoom[room].right.state = 2;
      console.log(this.gameRoom[room].right);
    }
  }

  @SubscribeMessage('handleKeyRelUp')
  async handleKeyRelUp(@ConnectedSocket() client, 
    @MessageBody() message) {
    // console.log(`${isLeftPlayer}가 up키를 떼었습니다.`);
    const [room, id] = message;
    if (id === 1)
    {
      this.gameRoom[room].left.state = 0;
      console.log(this.gameRoom[room].left);
    }
    else if (id === 2)
    {
      this.gameRoom[room].right.state = 0;
      console.log(this.gameRoom[room].left);
    }
  }

  @SubscribeMessage('handleKeyRelDown')
  async handleKeyRelDown(
    @ConnectedSocket() client,
    @MessageBody() message,
  ) {
    const [room, id] = message;
    if (id === 1)
    {
      this.gameRoom[room].left.state = 0;
      console.log(this.gameRoom[room].left);
    }
    else if (id === 2)
    {
      this.gameRoom[room].right.state = 0;
      console.log(this.gameRoom[room].left);
    }

  }
  
  private matchNormalQueue = [];
  private matchExtendQueue = [];

  // socket의 메시지를 room내부의 모든 이들에게 전달합니다.
  @SubscribeMessage('match')
  async enqueueMatch(@ConnectedSocket() client, @MessageBody() data) {
    // console.log("socket:", client);
    console.log("data:", data);
        
    const queueData = {
      socket: client,
      gameType: data
    };

    // type에 따라 큐 넣기
    if (data === false) {
      this.matchNormalQueue.push(queueData);
    }
    else {
      this.matchExtendQueue.push(queueData);
    }

    this.server.to(client.id).emit('enqueuecomplete', 200);

    if (this.matchNormalQueue.length >= 2) {
      const left = this.matchNormalQueue.shift();
      const right = this.matchNormalQueue.shift();
      
      const roomName = randomBytes(10).toString('hex');
      console.log("room Name:", roomName);
      // this.sock[left.socket.id] = roomName;
      // this.sock[right.socket.id] = roomName;
      
      // before
      console.log('speed: ', this.GameObject.ball.speed);
      
      const newGameObject: GameData = createGameData(
        createLeftPlayerObject(),
        createRightPlayerObject(),
        createBallObject(),
      );

      this.gameRoom[roomName] = newGameObject;
      console.log('gameRoom: ', this.gameRoom);
      console.log('gameRoom[roomName]: ', this.gameRoom[roomName]);
      // TODO roomname 필요
      left.socket.join(roomName); // TODO
      right.socket.join(roomName); // TODO
      this.server.to(roomName).emit('matchingcomplete', 200, roomName);
      this.server.to(left.socket.id).emit('isLeft', 1);
      this.server.to(right.socket.id).emit('isLeft', 2);

      console.log("matching 완료");
      this.startGame(roomName);
    }
  }

  isGameOver(leftScore : number, rightScore : number, roomName: string)
  {
    if (leftScore >= 5 || rightScore >= 5)
    {
      clearInterval(this.intervalIds[roomName]);
      if (leftScore >= 5) {
        this.server.to(roomName).emit('gameover', 1);
      }
      else if (rightScore >= 5) {
        this.server.to(roomName).emit('gameover', 2);
      }
    }
  }


  // cancel queue event
  // param[socketId]

  

}

// todo list
// 1. if click cancel, delete queue list
