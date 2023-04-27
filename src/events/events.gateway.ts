import { ConsoleLogger } from '@nestjs/common';
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
import { GameData, BallObject, PlayerObject, SocketInfo, GameType, createBallObject, createLeftPlayerObject, createRightPlayerObject, createGameData, createGameType } from './game.interface';

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

  // Board Info ex) canvas, moveValue, MaxGoal
  private canvasW = 600;
  private canvasH = 400;
  private moveValue = 4;
  private maxGoalScore = 5;
  
  // Game Object
  private ball: BallObject = createBallObject();
  private leftUser: PlayerObject = createLeftPlayerObject
  (0,                this.canvasH / 2 - 100 / 2, 10, 100, 0, 0);
  private rightUser: PlayerObject = createRightPlayerObject
  (this.canvasW - 10,this.canvasH / 2 - 100 / 2, 10, 100, 0, 0);

  private gameRoom: {[key: string]: any} = {};

  // frame id
  private intervalIds = {};

  // Waiting Queue
  private matchNormalQueue = [];
  private matchExtendQueue = [];

  // [key: nick, value: socketId]
  private nicktSocketMap = new Map<string, string>();
  // [key: socketId, value: socketInfo{roomName, playerId}]
  private socketRoomMap = new Map<string, SocketInfo>();
  

  // socketIO server가 처음 켜질(init)될때 동작하는 함수 - OnGatewayInit 짝궁
  
  private GameObject = {
    left: this.leftUser,
    right: this.rightUser,
    ball: this.ball
  }

  startGame(roomName: string) {
    function collision(b, p)
    {
      const playerTop = p.y;
      const playerBottom = p.y + p.height;
      const playerLeft = p.x;
      const playerRight = p.x + p.width;

      b.top = b.y - b.radius;
      b.bottom = b.y + b.radius;
      b.left = b.x - b.radius;
      b.right = b.x + b.radius;
      
      return b.right > playerLeft && b.bottom > playerTop && 
              b.left < playerRight && b.top < playerBottom;
    }

    function resetBall(ball, w, h) {
      // console.log(ball, w,h);
      ball.x = w / 2;
      ball.y = h / 2;
  
      ball.speed = 5;
      ball.velocityX = ball.velocityX; 
    }

    const setId = setInterval(() => {
      const data = this.gameRoom[roomName];

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
        resetBall(data.ball, this.canvasW, this.canvasH);
      } 
      else if (data.ball.x + data.ball.radius > this.canvasW){
        data.left.score++;
        resetBall(data.ball, this.canvasW, this.canvasH);
      }
      this.server.to(roomName).emit('render', data.left, data.right, data.ball, roomName);
      
      
      if (this.isGameOver(data.left.score, data.right.score, roomName))
      {
        // stop interval and clear
        clearInterval(this.intervalIds[roomName]);
        delete this.intervalIds[roomName];

        console.log("nickname Test", data.left.nick, data.right.nick);
        // socketMap clear
        const remainClients = this.server.sockets.adapter.rooms.get(roomName);
        for (const key of remainClients) {
          this.socketRoomMap.delete(key);
        }
        console.log("my socket:",this.socketRoomMap);

        const gameType = this.gameRoom[roomName].type.flag;
        let winScore, loseScore, winId, loserId;
        
        const winner = data.left.score > data.right.score ? data.left : data.right;
        const loser = data.left.score < data.right.score ? data.left : data.right;
        winScore = winner.score;
        loseScore = loser.score;
        winId = winner.nick;
        loserId = loser.nick;

        console.log("state: graceful exit", "mapNumber:", gameType, winScore, loseScore, "id:", winId, loserId);

        // remove socket room
        this.server.socketsLeave(roomName);
      }
    }, 20);

    // set Interval Id => if game end, need to clear setInterval
    // console.log("Set Id:", setId);
    this.intervalIds[roomName] = setId;
  }

  afterInit(server: Server) {
      

    console.log('WebSocketGateway initialized');
    
  }

  // 연결된 socket이 연결될때 동작하는 함수 - OnGatewayConnection 짝궁
  handleConnection(client: any, ...args: any[]) {
    console.log(`Client connected: ${client.id}`);
  }

  // 연결된 socket이 끊어질때 동작하는 함수 - OnGatewayDisconnect 짝궁
  handleDisconnect(client: any, ...args: any[]) {
    // Get roomName and PlayerId that the client belongs to.
    if (this.socketRoomMap.get(client.id) !== undefined)
    {
      const roomName = this.socketRoomMap.get(client.id).roomName;
      const playerId = this.socketRoomMap.get(client.id).playerId;

      // Delete client in socketRoomMap because of client leave our webPage
      this.socketRoomMap.delete(client.id);
      
            // only player 1 and 2 win
      if (playerId === 1 || playerId === 2)
      {
        let winScore, loseScore, winId, loserId;
        const gameType = this.gameRoom[roomName].type.flag;
        // player 2p win
        if (playerId === 1)
        {
          console.log(roomName, "is winner 2p");
          this.server.to(roomName).emit('gameover', 2);
          winScore = this.gameRoom[roomName].right.score;
          loseScore = this.gameRoom[roomName].left.score;
          winId = this.gameRoom[roomName].right.nick;
          loserId = this.gameRoom[roomName].left.nick;
        }
        // player 1p win
        else if (playerId === 2)
        {
          console.log(roomName, "is winner 1p");  
          this.server.to(roomName).emit('gameover', 1);
          
          winScore = this.gameRoom[roomName].left.score;
          loseScore = this.gameRoom[roomName].right.score;
          winId = this.gameRoom[roomName].left.nick;
          loserId = this.gameRoom[roomName].right.nick;
        }

        // Stop Game
        clearInterval(this.intervalIds[roomName]);
        delete this.intervalIds[roomName];


        // socketRoomMap[roomName] all clear
        // console.log("Roomssss", this.server.sockets.adapter.rooms.get(roomName));
        const remainClients = this.server.sockets.adapter.rooms.get(roomName);
        // console.log(typeof(remainClients));
        for (const key of remainClients) {
          // console.log(key);
          this.socketRoomMap.delete(key);
        }

        // Processing Database
        // Alee's TODO
        console.log("state: Quit", "mapNumber:", gameType, winScore, loseScore, "id:", winId, loserId);

        // remove socket(real socket) room
        this.server.socketsLeave(roomName);
      }
    }
    else{
      console.log("undifined");
    }
  }

  // press Up key
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

  // press Down key
  @SubscribeMessage('handleKeyPressDown')
  async handleKeyPressDown(
    @ConnectedSocket() client,
    @MessageBody() data
  ) {
    const [room, id] = data;
    console.log(room, id);
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

  // release Up Key
  @SubscribeMessage('handleKeyRelUp')
  async handleKeyRelUp(
    @ConnectedSocket() client, 
    @MessageBody() message) {
    const [roomName, id] = message;
    if (id === 1)
    {
      this.gameRoom[roomName].left.state = 0;
    }
    else if (id === 2)
    {
      this.gameRoom[roomName].right.state = 0;
    }
  }

  // release Down Key
  @SubscribeMessage('handleKeyRelDown')
  async handleKeyRelDown(
    @ConnectedSocket() client,
    @MessageBody() message,
  ) {
    const [roomName, id] = message;
    if (id === 1)
    {
      this.gameRoom[roomName].left.state = 0;
    }
    else if (id === 2)
    {
      this.gameRoom[roomName].right.state = 0;
    }
  }
  
  

  // socket의 메시지를 room내부의 모든 이들에게 전달합니다.
  @SubscribeMessage('match')
  async enqueueMatch(@ConnectedSocket() client, @MessageBody() data) {
    // console.log("socket:", client);
    console.log("data:", data);
        
    const queueData = {
      socket: client,
      gameType: data
      // nickname
    };

    // type에 따라 큐 넣기
    if (data === false) {
      this.matchNormalQueue.push(queueData);
    }
    else {
      this.matchExtendQueue.push(queueData);
    }

    this.server.to(client.id).emit('enqueuecomplete', 200);

    if (this.matchNormalQueue.length >= 2 || this.matchExtendQueue.length >= 2) {
      let left;
      let right;
      let gameType;
      if (this.matchNormalQueue.length >= 2)
      {
        left = this.matchNormalQueue.shift();
        right = this.matchNormalQueue.shift();
        gameType = false;
      }

      if (this.matchExtendQueue.length >= 2)
      {
        left = this.matchExtendQueue.shift();
        right = this.matchExtendQueue.shift();
        gameType = true;
      }

      const roomName = randomBytes(10).toString('hex');
      const newGameObject: GameData = 
      createGameData(
        createLeftPlayerObject(),
        createRightPlayerObject(),
        createBallObject(),
        createGameType(gameType),
      );
      
      // nickname add part

      this.gameRoom[roomName] = newGameObject;
      console.log('gameRoom: ', this.gameRoom);
      console.log('gameRoom[roomName]: ', this.gameRoom[roomName]);

      
      // TODO roomname 필요
      left.socket.join(roomName); // TODO
      right.socket.join(roomName); // TODO

      const leftInfo: SocketInfo = {roomName, playerId: 1};
      const rightInfo: SocketInfo = {roomName, playerId: 2};
      this.socketRoomMap.set(left.socket.id, leftInfo); 
      this.socketRoomMap.set(right.socket.id, rightInfo); 


      this.server.to(roomName).emit('matchingcomplete', 200, roomName);
      this.server.to(left.socket.id).emit('isLeft', 1);
      this.server.to(right.socket.id).emit('isLeft', 2);

      console.log("matching 완료");
      this.startGame(roomName);
    }
  }

  isGameOver(leftScore : number, rightScore : number, roomName: string)
  {
    if (leftScore >= this.maxGoalScore || rightScore >= this.maxGoalScore)
    {
      if (leftScore >= this.maxGoalScore) {
        this.server.to(roomName).emit('gameover', 1);
      }
      else if (rightScore >= this.maxGoalScore) {
        this.server.to(roomName).emit('gameover', 2);
      }
      return true;
    }
    return false;
  }

  // cancel queue event
  // param[socketId]
  @SubscribeMessage('cancel queue')
  async cancelQueue(@ConnectedSocket() client, @MessageBody() data) {
    console.log("cancel queue", client.id);
    console.log("cancel game type", data);

    // data 정의 X
    if (data === false)
    {
      for(var i = 0; i < this.matchNormalQueue.length; i++){ 
        console.log(this.matchNormalQueue[i].socket.id, client.id);
        if (this.matchNormalQueue[i].socket.id === client.id) { 
          this.matchNormalQueue.splice(i, 1);
          break;
        }
      }
    } else{
      for(var i = 0; i < this.matchNormalQueue.length; i++){ 
        if (this.matchExtendQueue[i].socket.id === client.id) { 
          this.matchExtendQueue.splice(i, 1); 
          break;
        }
      }
    }
    this.server.to(client.id).emit('cancel queue complete', 200);
  }

  @SubscribeMessage('want observer')
  async WatchingGame(@ConnectedSocket() client, @MessageBody() data) {

    const nickName: string = data;
    const sockid: string = this.nicktSocketMap.get(nickName);
    if (sockid !== undefined)
    {
      const roomName = this.socketRoomMap.get(sockid).roomName;
      client.join(roomName);
      this.server.to(client.id).emit('game observer', 200);  
      this.server.to(client.id).emit('isLeft', 3);
    }
    else {
      this.server.to(client.id).emit('observer fail', 200);
    }
  }

  @SubscribeMessage('Invite Game')
  async InviteGame(@ConnectedSocket() client, @MessageBody() data)
  {
    // 1. Check if your opponent is online or offline
    // 2. Check if your opponent is playing or spectating
    // 3. return invite complete event
    /*
    if (online)
    {
      if (playing x)
        this.server.to(client.id).emit('invite complete');    
    }
    */
    
    // else invite fail.
    this.server.to(client.id).emit('invite fail');
  }

  @SubscribeMessage('Accept invitation')
  async InviteOK(@ConnectedSocket() client, @MessageBody() data)
  {
    // 1. Check if your opponent is online or offline
    // 2. Check if your opponent is playing or spectating
    // 3. return invite complete event
    /*
    if (online)
    {
      if (playing x)
        this.server.to(client.id).emit('invite complete');    
    }
    */
  }
}


