import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { genSalt, hash } from 'bcrypt';
import { User } from 'src/domain/user/user.entity';
import { UserService } from 'src/domain/user/user.service';
import { SignInCredentialsDto } from './dto/sign-in-credentials.dto';
import { SignUpCredentialsDto } from './dto/sign-up-credentials.dto';
import { JwtPayload } from './jwt/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
  ) {}

  public async signUp(
    credentialsDto: SignUpCredentialsDto,
  ): Promise<User | null> {
    const { name, email, password } = credentialsDto;

    const userWithSameNameOrEmail =
      await this.userService.findUserByNameOrEmail(name, email);
    if (userWithSameNameOrEmail)
      throw new BadRequestException('Username/E-mail already in use.');
    const salt = await genSalt();
    const hashedPassword = await hash(password, salt);
    const user = await this.userService.create({
      name,
      email,
      password: hashedPassword,
      salt,
    });
    delete user.password;
    delete user.salt;
    return user;
  }

  public async signIn(
    credentialsDto: SignInCredentialsDto,
  ): Promise<{ accessToken: string }> {
    const user = await this.validateUser(credentialsDto);
    const payload: JwtPayload = { sub: user.id, userName: user.name };
    const accessToken: string = await this.jwtService.signAsync(payload);
    return { accessToken };
  }

  private async validateUser(
    credentialsDto: SignInCredentialsDto,
  ): Promise<User> {
    const { email, password } = credentialsDto;
    const user = await this.userService.findUserByNameOrEmailForLogin(
      null,
      email,
    );
    if (
      !user ||
      !(await this.validatePassword(user.password, user.salt, password))
    )
      throw new UnauthorizedException('Invalid credentials.');
    return user;
  }

  private async validatePassword(
    userPassword: string,
    userSalt: string,
    inputPassword: string,
  ): Promise<boolean> {
    return userPassword === (await hash(inputPassword, userSalt));
  }
}
