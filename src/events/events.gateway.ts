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
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private intervalId: NodeJS.Timeout;
  // 게임 데이터.
  private pos1: number;
  private pos2: number;
  private isMoveUp1: boolean;
  private isMoveDown1: boolean;
  private isMoveUp2: boolean;
  private isMoveDown2: boolean;

  // 연결된 socket이 끊어질때 동작하는 함수
  handleConnection(client: any, ...args: any[]) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect() {
    console.log('WebSocketGateway disconnected');
  }

  // socketIO server가 처음 켜질(init)될때 동작하는 함수
  afterInit(server: Server) {
    console.log('WebSocketGateway initialized');
    this.pos1 = 0;
    this.pos2 = 0;
    // 현재 게임데이터 pos1, pos2를 'gshim' room의 참가자들에게 1초에 10번씩 무한으로 전달하는 함수
    this.intervalId = setInterval(() => {
      //console.log('render....');
      this.server.to('gshim').emit('render', this.pos1, this.pos2);

      if (this.isMoveUp1) {
        this.pos1 = Math.max(this.pos1 - 1, -4); // set the upper limit to -4
      } else if (this.isMoveDown1) {
        this.pos1 = Math.max(this.pos1 + 1, 4); // set the upper limit to -4
      }

      if (this.isMoveUp2) {
        this.pos2 = Math.max(this.pos2 - 1, -4); // set the upper limit to -4
      } else if (this.isMoveDown2) {
        this.pos2 = Math.max(this.pos2 + 1, 4); // set the upper limit to -4
      }
    }, 100); // send the event every 100ms (10 times per second)
  }

  // socket의 메시지를 room내부의 모든 이들에게 전달합니다.
  @SubscribeMessage('chat')
  async handleChat(@ConnectedSocket() client, @MessageBody() data) {
    console.log('chat: ', data);
    client.to('gshim').emit('chat', data);
  }

  // socket을 특정 room에 join 시킵니다.
  @SubscribeMessage('join')
  async handleJoin(@ConnectedSocket() client, @MessageBody() data) {
    const gshimNum = this.server.sockets.adapter.rooms.get('gshim').size;
    console.log('clientId: ', client.id, 'join to room gshim');
    client.join('gshim');
    console.log(
      `현재 게임룸 현황(${gshimNum}): ${this.server.sockets.adapter.rooms.get(
        'gshim',
      )}`,
    );
    // join한 socket에게 본인이 왼쪽플레이어인지 오른쪽플레이어인지 알려준다.
    this.server.to(client.id).emit('isLeft', gshimNum % 2);
  }

  // 여기서부터 게임이벤트 =====================================
  @SubscribeMessage('handleKeyPressUp')
  async handleKeyPressUp(
    @ConnectedSocket() client,
    @MessageBody() isLeftPlayer,
  ) {
    console.log(`${isLeftPlayer}가 up키를 눌렸습니다.`);
    this.setIsMovingUp(isLeftPlayer, true);
  }

  @SubscribeMessage('handleKeyPressDown')
  async handleKeyPressDown(
    @ConnectedSocket() client,
    @MessageBody() isLeftPlayer,
  ) {
    console.log(`${isLeftPlayer}가 down키를 눌렸습니다.`);
    this.setIsMovingDown(isLeftPlayer, true);
  }

  @SubscribeMessage('handleKeyRelUp')
  async handleKeyRelUp(@ConnectedSocket() client, @MessageBody() isLeftPlayer) {
    console.log(`${isLeftPlayer}가 up키를 떼었습니다.`);
    this.setIsMovingUp(isLeftPlayer, false);
  }

  @SubscribeMessage('handleKeyRelDown')
  async handleKeyRelDown(
    @ConnectedSocket() client,
    @MessageBody() isLeftPlayer,
  ) {
    console.log(`${isLeftPlayer}가 down키를 떼었습니다.`);
    this.setIsMovingDown(isLeftPlayer, false);
  }

  // 왼/오른쪽 플레이어가 위로 움직이는 중인지 여부를 저장하는 함수
  setIsMovingUp(isLeftPlayer, x: boolean) {
    if (isLeftPlayer) this.isMoveUp1 = x;
    else this.isMoveUp2 = x;
  }
  // 왼/오른쪽 플레이어가 아래로 움직이는 중인지 여부를 저장하는 함수
  setIsMovingDown(isLeftPlayer, x: boolean) {
    if (isLeftPlayer) this.isMoveDown1 = x;
    else this.isMoveDown2 = x;
  }
}
