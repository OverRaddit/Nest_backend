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
  handleDisconnect(client: any) {
    console.log(`Client disconnected: ${client.id}`);
  }
  handleConnection(client: any, ...args: any[]) {
    console.log(`Client connected: ${client.id}`);
  }
  afterInit(server: any) {
    console.log(`Server init: ${server}`);
  }

  @WebSocketServer()
  server: Server;

  @SubscribeMessage('events')
  async handleEvent(@MessageBody() data) {
    console.log('events: ', data);
    //return data;
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
    console.log('join: ', data);
    console.log('clientId: ', client.id);
    client.join('gshim');
    // how can i check wether client join gshim room?
    console.log(this.server.sockets.adapter.rooms);
    client.to('gshim').emit('welcome');
  }
}
