import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY', '');
    this.from = this.configService.get<string>('RESEND_FROM', 'Çay Platformu <noreply@cayhesabim.com>');

    if (apiKey) {
      this.resend = new Resend(apiKey);
      this.logger.log(`Resend initialized with from: ${this.from}`);
    } else {
      this.resend = null;
      this.logger.warn('RESEND_API_KEY is not configured. Email sending is disabled.');
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.resend) {
      this.logger.warn(`Email to ${options.to} skipped: RESEND_API_KEY not configured.`);
      return false;
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.from,
        to: [options.to],
        subject: options.subject,
        html: options.html,
      });

      if (error) {
        this.logger.error(`Failed to send email to ${options.to}`, error);
        return false;
      }

      this.logger.log(`Email sent to ${options.to}, ID: ${data?.id}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}`, error);
      return false;
    }
  }

  async sendVerificationEmail(
    email: string,
    fullName: string,
    token: string,
  ): Promise<boolean> {
    const appUrl = this.configService.get<string>('APP_URL');
    const verificationLink = `${appUrl}/verify-email?token=${token}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10B981;">Çay Üreticisi Platformu</h2>
        <p>Merhaba ${fullName},</p>
        <p>Çay Üreticisi Platformu'na hoş geldiniz!</p>
        <p>Email adresinizi doğrulamak ve hesabınızı aktifleştirmek için lütfen aşağıdaki butona tıklayın:</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}" 
             style="background-color: #10B981; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 6px; display: inline-block;">
            Email Adresimi Doğrula
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">Bu link 24 saat geçerlidir.</p>
        <p style="color: #666; font-size: 14px;">
          Eğer bu hesabı siz oluşturmadıysanız, bu e-postayı görmezden gelebilirsiniz.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">
          İyi günler,<br>Çay Üreticisi Platformu Ekibi
        </p>
      </div>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Çay Üreticisi Platformu - Email Adresinizi Doğrulayın',
      html,
    });
  }

  async sendPasswordResetEmail(
    email: string,
    fullName: string,
    token: string,
  ): Promise<boolean> {
    const appUrl = this.configService.get<string>('APP_URL');
    const resetLink = `${appUrl}/reset-password?token=${token}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10B981;">Çay Üreticisi Platformu</h2>
        <p>Merhaba ${fullName},</p>
        <p>Hesabınız için şifre sıfırlama talebinde bulundunuz.</p>
        <p>Yeni bir şifre oluşturmak için aşağıdaki butona tıklayın:</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" 
             style="background-color: #10B981; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 6px; display: inline-block;">
            Şifremi Sıfırla
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">Bu link 1 saat geçerlidir.</p>
        <p style="color: #666; font-size: 14px;">
          Eğer bu talebi siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">
          İyi günler,<br>Çay Üreticisi Platformu Ekibi
        </p>
      </div>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Çay Üreticisi Platformu - Şifre Sıfırlama',
      html,
    });
  }

  async sendStaffInviteEmail(
    email: string,
    fullName: string,
    token: string,
    roleLabel: string,
  ): Promise<boolean> {
    const appUrl = this.configService.get<string>('APP_URL');
    const setupLink = `${appUrl}/reset-password?token=${token}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #15803D;">Çaykur Kurumsal Platform</h2>
        <p>Merhaba ${fullName},</p>
        <p>Çaykur Kurumsal Platform'a <strong>${roleLabel}</strong> olarak tanımlandınız.</p>
        <p>Hesabınızı etkinleştirmek ve şifrenizi belirlemek için aşağıdaki butona tıklayın:</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${setupLink}"
             style="background-color: #15803D; color: white; padding: 12px 30px;
                    text-decoration: none; border-radius: 8px; display: inline-block;">
            Şifremi Belirle
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">Bu link 24 saat geçerlidir.</p>
        <p style="color: #666; font-size: 14px;">
          Bu daveti beklemiyorsanız, bu e-postayı görmezden gelebilirsiniz.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">
          İyi günler,<br>Çaykur Kurumsal Platform Ekibi
        </p>
      </div>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Çaykur Kurumsal Platform - Hesap Daveti',
      html,
    });
  }

  async sendPasswordChangedEmail(
    email: string,
    fullName: string,
    ipAddress: string,
  ): Promise<boolean> {
    const changeDate = new Date().toLocaleString('tr-TR');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10B981;">Çay Üreticisi Platformu</h2>
        <p>Merhaba ${fullName},</p>
        <p>Hesabınızın şifresi başarıyla değiştirildi.</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Değişiklik Tarihi:</strong> ${changeDate}</p>
          <p style="margin: 5px 0;"><strong>IP Adresi:</strong> ${ipAddress}</p>
        </div>
        <p style="color: #EF4444; font-weight: bold;">
          Eğer bu değişikliği siz yapmadıysanız, lütfen derhal destek ekibi ile iletişime geçin.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">
          İyi günler,<br>Çay Üreticisi Platformu Ekibi
        </p>
      </div>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Çay Üreticisi Platformu - Şifreniz Değiştirildi',
      html,
    });
  }

  async sendDeletionConfirmationEmail(
    email: string,
    fullName: string,
    token: string,
  ): Promise<boolean> {
    const appUrl = this.configService.get<string>('APP_URL');
    const deletionLink = `${appUrl}/confirm-deletion?token=${token}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #EF4444;">Çay Üreticisi Platformu</h2>
        <p>Merhaba ${fullName},</p>
        <p><strong>Hesabınızı silme talebinde bulundunuz.</strong></p>
        <div style="background: #FEF2F2; border: 1px solid #EF4444; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="color: #EF4444; font-weight: bold; margin: 0;">⚠️ UYARI: Bu işlem geri alınamaz!</p>
        </div>
        <p>Silme işlemini onaylamak için aşağıdaki butona tıklayın:</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${deletionLink}" 
             style="background-color: #EF4444; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 6px; display: inline-block;">
            Hesabımı Sil
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">Bu link 24 saat geçerlidir.</p>
        <p style="color: #666; font-size: 14px;">
          Eğer bu talebi siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">
          İyi günler,<br>Çay Üreticisi Platformu Ekibi
        </p>
      </div>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Çay Üreticisi Platformu - Hesap Silme Onayı',
      html,
    });
  }

  async sendAccountDeletedEmail(email: string): Promise<boolean> {
    const deletionDate = new Date().toLocaleString('tr-TR');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10B981;">Çay Üreticisi Platformu</h2>
        <p>Merhaba,</p>
        <p>Çay Üreticisi Platformu hesabınız <strong>${deletionDate}</strong> tarihinde başarıyla silindi.</p>
        <p>Tüm kişisel verileriniz sistemimizden kaldırılmıştır.</p>
        <p>Platformumuzu kullandığınız için teşekkür ederiz.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px;">
          İyi günler,<br>Çay Üreticisi Platformu Ekibi
        </p>
      </div>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Çay Üreticisi Platformu - Hesabınız Silindi',
      html,
    });
  }
}
