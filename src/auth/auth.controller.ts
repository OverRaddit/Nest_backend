import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

@Controller('auth')
export class AuthController {
  @Get()
  @UseGuards(AuthGuard('42'))
  helloWorld() {
    return 'Hello!';
  }

  @Get('/redirect')
  @UseGuards(AuthGuard('42'))
  async fortyTwoCallback(@Req() req: Request) {
    const user = req?.user;
    console.log('User: ', user);
    // jwt 만들기. 이때 jwt payload에 user.id
    // response.cookie(jwt);
    return 'Authentication successful!';
  }
}
