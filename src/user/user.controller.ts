import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AdminUpdateUserDto } from './dto/AdminUpdateUserDto .dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    return await this.userService.create(createUserDto);
  }

  @Get()
  async findAll() {
    return await this.userService.findAll();
  }

  @Get('/usuario-con-notificacion')
  async findAllUserWithNot() {
    return await this.userService.findAllUserWithNot();
  }

  @Get('/to-select')
  async getUsersToSelect() {
    return await this.userService.getUsersToSelect();
  }

  @Get('/fin-my-user/:id')
  async findMyUser(@Param('id', ParseIntPipe) id: number) {
    return await this.userService.findMyUser(id);
  }

  @Get('/fin-all-users')
  async findAllUsers() {
    return await this.userService.findAllUsersWithSales();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.userService.findOne(+id);
  }

  @Patch('/update-user/as-admin/:id')
  async updateUserAsAdmin(
    @Param('id', ParseIntPipe) id: number,
    @Body() adminUpdateUserDto: AdminUpdateUserDto,
  ) {
    return await this.userService.updateUserAsAdmin(id, adminUpdateUserDto);
  }

  @Patch('/update-user/:id')
  async updateMyUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return await this.userService.updateMyUser(id, updateUserDto);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return await this.userService.update(+id, updateUserDto);
  }

  @Delete('/delete-all')
  async removeAll() {
    return await this.userService.removeAllUsers();
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return await this.userService.remove(id);
  }
}
