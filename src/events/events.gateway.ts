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
import { Server, Socket } from 'socket.io';

type BallObject = {
  x: number,
  y: number,
  radius: number,
  speed : number,
  velocityX : number,
  velocityY : number,
}

type Player = {
  x: number,
  y: number,
  width : number,
  height: number,
  score: number,
  state: number
}

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

  private intervalId: NodeJS.Timeout;
  // 게임 데이터.
  // private pos1: number;
  // private pos2: number;
  // private isMoveUp1: boolean;
  // private isMoveDown1: boolean;
  // private isMoveUp2: boolean;
  // private isMoveDown2: boolean;

  private canvasW = 1000;
  private canvasH = 1000;
  private moveValue = 8;
  // add
  private ball: BallObject = {
    x: this.canvasW / 2,
    y: this.canvasH / 2,
    radius: 10,
    speed: 30,
    velocityX: 5,
    velocityY: 5,
  };

  private leftUser: Player = {
    x:0,
    y:this.canvasH / 2 - 100 / 2,
    width : 10,
    height: 100,
    score:0,
    state:0
  };
  private rightUser: Player = {
    x:this.canvasW,
    y:this.canvasH / 2 - 100 / 2,
    width : 10,
    height: 100,
    score:0,
    state:0
  };


  resetBall(){
    this.ball.x = this.canvasW / 2 + 10;
    this.ball.y = this.canvasH / 2;

    this.ball.speed = 100;
    this.ball.velocityX = -this.ball.velocityX; 
  }

  // socketIO server가 처음 켜질(init)될때 동작하는 함수 - OnGatewayInit 짝궁
  afterInit(server: Server) {
    console.log('WebSocketGateway initialized');
    // 현재 게임데이터 pos1, pos2를 'gshim' room의 참가자들에게 1초에 10번씩 무한으로 전달하는 함수
    this.intervalId = setInterval(() => {
      this.ball.x += this.ball.velocityX;
      this.ball.y += this.ball.velocityY;

      let player = (this.ball.x < this.canvasW / 2) ? this.leftUser : this.rightUser;

      if (collision(this.ball, player))
      {
        let collidePoint = this.ball.y - (player.y + player.height / 2);
        collidePoint = collidePoint / (player.height / 2);

        let angleRad = collidePoint * Math.PI / 4;
        let direction = (this.ball.x < this.canvasW /  2) ? 1 : -1;
        this.ball.velocityX = direction *  this.ball.speed * Math.cos(angleRad);
        this.ball.velocityY =              this.ball.speed * Math.sin(angleRad);

        this.ball.speed += 0.1;
      }

      // update paddle
    //   console.log(this.leftUser.y, this.rightUser.y)
      if (this.leftUser.state == 1){
        console.log("up");
        this.leftUser.y = Math.max(this.leftUser.y - this.moveValue, 0);
      }
      else if (this.leftUser.state == 2){
        console.log("down", this.leftUser.y + this.moveValue, this.canvasH - this.leftUser.height, this.leftUser.y);
        this.leftUser.y = Math.min(this.leftUser.y + this.moveValue, this.canvasH - this.leftUser.height);
        console.log("after", this.leftUser.y + this.moveValue, this.canvasH - this.leftUser.height, this.leftUser.y);
      }
      if (this.rightUser.state == 1){
        this.rightUser.y = Math.max(this.rightUser.y - this.moveValue, 0);
      }
      else if (this.rightUser.state == 2){
        this.rightUser.y = Math.min(this.rightUser.y + this.moveValue, this.canvasH - this.rightUser.height);
      }

      // update the score
      if (this.ball.x - this.ball.radius < 0)
      {
        this.rightUser.score++;
		this.isGameOver(this.leftUser.score, this.rightUser.score);
        this.resetBall();
      } 
      else if (this.ball.x + this.ball.radius > this.canvasW){
        this.leftUser.score++;
		this.isGameOver(this.leftUser.score, this.rightUser.score);
        this.resetBall();
      }

      this.server.to('gshim').emit('render', this.leftUser, this.rightUser, this.ball);
    }, 40); // send the event every 20ms (50 times per second)
  }

  // 연결된 socket이 연결될때 동작하는 함수 - OnGatewayConnection 짝궁
  handleConnection(client: any, ...args: any[]) {
    console.log(`Client connected: ${client.id}`);
  }

  // 연결된 socket이 끊어질때 동작하는 함수 - OnGatewayDisconnect 짝궁
  handleDisconnect() {
    console.log('WebSocketGateway disconnected');
  }

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
    client.join('gshim');
    console.log(
      `현재 게임룸 현황(${gshimNum}): ${this.server.sockets.adapter.rooms.get(
        'gshim',
      )}`,
    );
    // join한 socket에게 본인이 왼쪽플레이어인지 오른쪽플레이어인지 알려준다.
    this.server.to(client.id).emit('isLeft', gshimNum); // TODO
  }

  // 여기서부터 게임이벤트 =====================================
  @SubscribeMessage('handleKeyPressUp')
  async handleKeyPressUp(
    @ConnectedSocket() client,
    @MessageBody() isLeftPlayer,
  ) {
    // console.log(`${isLeftPlayer}가 up키를 눌렸습니다.`);
    this.setIsMovingUp(isLeftPlayer, 1);
  }

  @SubscribeMessage('handleKeyPressDown')
  async handleKeyPressDown(
    @ConnectedSocket() client,
    @MessageBody() isLeftPlayer,
  ) {
    // console.log(`${isLeftPlayer}가 down키를 눌렸습니다.`);
    this.setIsMovingDown(isLeftPlayer, 2);
  }

  @SubscribeMessage('handleKeyRelUp')
  async handleKeyRelUp(@ConnectedSocket() client, @MessageBody() isLeftPlayer) {
    // console.log(`${isLeftPlayer}가 up키를 떼었습니다.`);
    this.setIsMovingUp(isLeftPlayer, 0);
  }

  @SubscribeMessage('handleKeyRelDown')
  async handleKeyRelDown(
    @ConnectedSocket() client,
    @MessageBody() isLeftPlayer,
  ) {
    // console.log(`${isLeftPlayer}가 down키를 떼었습니다.`);
    this.setIsMovingDown(isLeftPlayer, 0);
  }

  // 왼/오른쪽 플레이어가 위로 움직이는 중인지 여부를 저장하는 함수
  setIsMovingUp(isLeftPlayer, x: number) {
    if (isLeftPlayer == 1) {
      this.leftUser.state = x;
    }
    else if (isLeftPlayer == 2){
      this.rightUser.state = x;
    }
  }
  // 왼/오른쪽 플레이어가 아래로 움직이는 중인지 여부를 저장하는 함수
  setIsMovingDown(isLeftPlayer, x: number) {
    if (isLeftPlayer == 1){
      this.leftUser.state = x;
    }
    else if (isLeftPlayer == 2) 
      this.rightUser.state = x;
  }

  isGameOver(leftScore : number, rightScore : number)
  {
	if (leftScore >= 5){
		this.server.to('gshim').emit('gameover', 1);
		console.log("game end 1p");
		this.ball.x = this.canvasW / 2 - 10;
		this.ball.y = this.canvasH / 2;
		this.ball.radius = 10;
		this.ball.speed = 0;
		this.ball.velocityX = 0;
		this.ball.velocityY = 0;
		
		
		// this.leftUser.x = 0;
		// this.leftUser.y = 0;
		// this.leftUser.width = 0;
		// this.leftUser.height = 0;
		// this.leftUser.score = 0;
		// this.leftUser.state = 0;
		
		// this.rightUser.x = 0;
		// this.rightUser.y = 0;
		// this.rightUser.width = 0;
		// this.rightUser.height = 0;
		// this.rightUser.score = 0;
		// this.rightUser.state = 0;

	}
	else if (rightScore >= 5){
		this.server.to('gshim').emit('gameover', 2);
		console.log("game end 2p");
		this.ball.x = this.canvasW / 2;
		this.ball.y = this.canvasH / 2;
		this.ball.radius = 10;
		this.ball.speed = 0;
		this.ball.velocityX = 0;
		this.ball.velocityY = 0;
		
		
		// this.leftUser.x = 0;
		// this.leftUser.y = 0;
		// this.leftUser.width = 0;
		// this.leftUser.height = 0;
		// this.leftUser.score = 0;
		// this.leftUser.state = 0;
		
		// this.rightUser.x = 0;
		// this.rightUser.y = 0;
		// this.rightUser.width = 0;
		// this.rightUser.height = 0;
		// this.rightUser.score = 0;
		// this.rightUser.state = 0;
	}
  }
}
