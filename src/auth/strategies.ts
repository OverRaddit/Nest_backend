import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-42';

@Injectable()
export class FortyTwoStrategy extends PassportStrategy(Strategy, '42') {
  constructor() {
    super({
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: process.env.CALLBACK_URL,
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: any,
  ) {
    // console.log(accessToken);
    // console.log(refreshToken);
    //console.log(profile._json);

    const { id, email, nickname } = profile._json;
    const user = { id, email, nickname };
    //done(null, user);
    return user; // req.user로 들어감.
  }
}
