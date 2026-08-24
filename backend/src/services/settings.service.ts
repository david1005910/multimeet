import prisma from '../utils/prisma';

export class SettingsService {
  async getSettings(userId: string) {
    let settings = await prisma.userSettings.findUnique({ where: { userId } });
    if (!settings) {
      settings = await prisma.userSettings.create({
        data: { userId, defaultLanguage: 'en', autoDeleteAudio: false, minutesTemplate: 'standard' },
      });
    }
    return settings;
  }

  async updateSettings(userId: string, data: {
    defaultLanguage?: string;
    autoDeleteAudio?: boolean;
    minutesTemplate?: string;
  }) {
    return prisma.userSettings.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }
}

export const settingsService = new SettingsService();
