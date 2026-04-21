import { BadRequestException, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import * as hash from 'crypto';
import { PrismaService } from 'src/common/prisma.service';
import { ChatResponseDto } from 'src/dock/dto/chat-response.dto';
import { TokenPayload } from 'src/user/dto/token-payload.dto';
import { CreateChatDto } from './dto/create-chat.dto';
import { ChatStatus } from 'src/common/shared-enum';

@Injectable()
export class ChatService {
  constructor(private readonly prismaService: PrismaService) {}

  private async getTotalUnreadCount(userInfo: TokenPayload): Promise<number> {
    return this.prismaService.chat.count({
      where: {
        recipientId: userInfo.username,
        status: { not: ChatStatus.READ },
      },
    });
  }

  async sendMessage(dto: CreateChatDto) {
    const recipientId = dto.recipientId;
    if (!recipientId) {
      throw new BadRequestException('recipientId tidak valid');
    }
    const isreceiverValid = await this.prismaService.user.findFirst({
      where: { username: recipientId },
    });
    if (!isreceiverValid) {
      throw new BadRequestException('receiverId tidak valid');
    }

    const roomId = this.getRoomId(dto.senderId, recipientId);
    const chat = await this.prismaService.chat.create({
      data: {
        senderId: dto.senderId,
        status: ChatStatus.DELIVERED,
        recipientId: recipientId,
        message: dto.message,
        room: {
          connectOrCreate: {
            where: { id: roomId },
            create: { id: roomId },
          },
        },
      },
    });

    // hemat storage: batasi panjang caht
    if (Math.random() < 0.01) {
      await this.cleanupRoom(chat.roomId);
    }

    await this.prismaService.room.update({
      where: { id: chat.roomId },
      data: { lastMessageAt: chat.createdAt },
    });

    return plainToInstance(ChatResponseDto, chat, {
      excludeExtraneousValues: true,
    });
  }

  async deleteSelectedMessages(chatIds: string[], userinfo: TokenPayload) {
    await this.prismaService.chat.deleteMany({
      where: {
        id: {
          in: chatIds,
        },
        senderId: userinfo.username,
      },
    });
  }

  async getHistory(
    roomId: string, // bisa oper recipientId juga
    lastMessageLimit: number,
    userInfo: TokenPayload,
  ) {
    let messages = await this.prismaService.chat.findMany({
      where: {
        roomId: roomId,
      },
      take: lastMessageLimit,
      orderBy: {
        createdAt: 'desc', //emang begini
      },
    });
    messages.reverse();
    this.readAllMessage(
      roomId,
      messages[messages.length - 1]?.createdAt,
      userInfo,
    );

    return plainToInstance(ChatResponseDto, messages, {
      excludeExtraneousValues: true,
    });
  }

  async getLastMessages(userInfo: TokenPayload, searchKeyUser?: string) {
    const systemRoomId = this.getRoomId('system', userInfo.username);
    const rooms = await this.prismaService.room.findMany({
      where: {
        OR: [
          { chats: { some: { senderId: userInfo.username } } },
          { chats: { some: { recipientId: userInfo.username } } },
          {
            id: systemRoomId,
            chats: { some: {} },
          },
        ],
      },
      orderBy: { lastMessageAt: 'desc' },
      include: {
        chats: {
          orderBy: { createdAt: 'desc' },
          take: 2,
        },
      },
    });
    const chatRooms = (
      await Promise.all(
        rooms.map(async (room) => {
          const chats = room.chats;
          const latest = chats[0];
          if (!latest) return null;

          const otherUser =
            latest.senderId === userInfo.username
              ? latest.recipientId
              : latest.senderId;
          if (!otherUser) return null;

          const unreadMessages = await this.prismaService.chat.count({
            where: {
              roomId: room.id,
              recipientId: userInfo.username,
              status: 'DELIVERED',
            },
          });

          return {
            roomId: room.id,
            recipientId: otherUser,
            lastMessage: latest.message ?? null,
            lastMessageAt: room.lastMessageAt,
            unreadMessages,
          };
        }),
      )
    )
      .filter(Boolean)
      .filter((r) =>
        searchKeyUser
          ? r.recipientId.toLowerCase().includes(searchKeyUser.toLowerCase())
          : true,
      );

    // tambah user yang belum pernah chat
    if (searchKeyUser) {
      const users = await this.prismaService.user.findMany({
        where: {
          username: {
            contains: searchKeyUser,
            mode: 'insensitive',
          },
          NOT: {
            username: userInfo.username,
          },
        },
      });

      users.forEach((u) => {
        if (!chatRooms.find((r) => r.recipientId === u.username)) {
          chatRooms.push({
            roomId: this.getRoomId(userInfo.username, u.username),
            recipientId: u.username,
            lastMessage: null,
            lastMessageAt: null,
            unreadMessages: 0,
          });
        }
      });
    }

    const totalUnreadMessages = await this.getTotalUnreadCount(userInfo);

    return {
      chatRooms,
      totalUnreadMessages,
    };
  }

  //ini menjadikan sender dan recipient menjadi hash
  getRoomId(userA: string, userB: string): string {
    const sortedUsers = [userA, userB].sort();
    return hash
      .createHash('sha256')
      .update(sortedUsers.join(':'))
      .digest('hex');
  }

  async readAllMessage(
    roomId: string,
    recentMessageSeen: Date,
    userInfo: TokenPayload,
  ) {
    //update bahwa sudah read
    await this.prismaService.chat.updateMany({
      where: {
        roomId: roomId,
        status: ChatStatus.DELIVERED,
        recipientId: userInfo.username,
        createdAt: { lte: recentMessageSeen },
      },
      data: {
        status: 'READ',
      },
    });
    return {
      success: true,
    };
  }

  async cleanupRoom(roomId: string) {
    const MAX = 1000;

    const count = await this.prismaService.chat.count({
      where: { roomId },
    });

    if (count <= MAX) return;

    const ids = await this.prismaService.chat.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      skip: MAX,
      select: { id: true },
    });

    await this.prismaService.chat.deleteMany({
      where: {
        id: { in: ids.map((i) => i.id) },
      },
    });
  }
}
