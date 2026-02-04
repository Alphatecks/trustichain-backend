import { Resend } from 'resend';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

// Initialize Resend client
const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export class EmailService {
  /**
   * Get logo as base64 data URI
   */
  private getLogoBase64(): string {
    try {
      const logoPath = path.join(process.cwd(), 'assets', 'logo.png');
      const logoBuffer = fs.readFileSync(logoPath);
      return `data:image/png;base64,${logoBuffer.toString('base64')}`;
    } catch (error) {
      console.error('Error reading logo file:', error);
      return '';
    }
  }

  /**
   * Get Satoshi font as base64 data URI
   */
  private getSatoshiFontBase64(): string {
    try {
      const fontPath = path.join(process.cwd(), 'assets', 'fonts', 'satoshi', 'Satoshi-Regular.otf');
      const fontBuffer = fs.readFileSync(fontPath);
      return `data:font/otf;base64,${fontBuffer.toString('base64')}`;
    } catch (error) {
      console.error('Error reading Satoshi font file:', error);
      return '';
    }
  }

  /**
   * Send email verification link
   * @param email - User email address
   * @param verificationToken - Verification token
   * @param fullName - User's full name
   */
  async sendVerificationEmail(
    email: string,
    verificationToken: string,
    fullName: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!resend) {
        const errorMsg = 'Resend API key not configured. Please set RESEND_API_KEY environment variable.';
        console.error(errorMsg);
        throw new Error(errorMsg);
      }

      if (!process.env.RESEND_FROM_EMAIL) {
        const errorMsg = 'Resend from email not configured. Please set RESEND_FROM_EMAIL environment variable.';
        console.error(errorMsg);
        throw new Error(errorMsg);
      }

      const backendUrl = process.env.BACKEND_URL || process.env.RENDER_URL || 'http://localhost:3000';
      // Link goes to backend GET endpoint, which verifies and redirects to frontend
      const verificationLink = `${backendUrl}/api/auth/verify-email?token=${verificationToken}`;

      console.log(`Attempting to send verification email to: ${email}`);
      console.log(`Using Resend from: ${process.env.RESEND_FROM_EMAIL}`);
      console.log(`Backend URL: ${backendUrl}`);

      const { data, error } = await (resend as any).emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to: email,
        subject: 'Verify Your TrustiChain Account',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verify Your Email</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">Welcome to TrustiChain!</h1>
            </div>
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
              <p>Hi ${fullName},</p>
              <p>Thank you for signing up for TrustiChain! Please verify your email address to complete your registration and start using our platform.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationLink}" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: white; 
                          padding: 15px 30px; 
                          text-decoration: none; 
                          border-radius: 5px; 
                          display: inline-block; 
                          font-weight: bold;">
                  Verify Email Address
                </a>
              </div>
              <p style="font-size: 12px; color: #666; margin-top: 30px;">
                Or copy and paste this link into your browser:<br>
                <a href="${verificationLink}" style="color: #667eea; word-break: break-all;">${verificationLink}</a>
              </p>
              <p style="font-size: 12px; color: #666;">
                This link will expire in 24 hours. If you didn't create an account, please ignore this email.
              </p>
            </div>
            <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
              <p>&copy; ${new Date().getFullYear()} TrustiChain. All rights reserved.</p>
            </div>
          </body>
          </html>
        `,
        text: `
          Hi ${fullName},
          
          Thank you for signing up for TrustiChain! Please verify your email address to complete your registration.
          
          Click this link to verify: ${verificationLink}
          
          This link will expire in 24 hours. If you didn't create an account, please ignore this email.
          
          © ${new Date().getFullYear()} TrustiChain. All rights reserved.
        `,
      });

      if (error) {
        console.error('Resend email error:', error);
        return { success: false, error: error.message || 'Failed to send email via Resend' };
      }

      console.log('Verification email sent successfully via Resend:', {
        id: data?.id,
        to: email,
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send verification email';
      console.error('Email sending error:', error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send password reset OTP email
   * @param email - User email address
   * @param otp - 6-digit OTP code
   * @param fullName - User's full name
   */
  async sendPasswordResetOTP(
    email: string,
    otp: string,
    fullName: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!resend) {
        const errorMsg = 'Resend API key not configured. Please set RESEND_API_KEY environment variable.';
        console.error(errorMsg);
        throw new Error(errorMsg);
      }

      if (!process.env.RESEND_FROM_EMAIL) {
        const errorMsg = 'Resend from email not configured. Please set RESEND_FROM_EMAIL environment variable.';
        console.error(errorMsg);
        throw new Error(errorMsg);
      }

      console.log(`Attempting to send password reset OTP email to: ${email}`);

      const { data, error } = await (resend as any).emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to: email,
        subject: 'Password Reset OTP - TrustiChain',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Password Reset OTP</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">Password Reset Request</h1>
            </div>
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
              <p>Hi ${fullName},</p>
              <p>You requested to reset your password. Use the OTP code below to reset your password:</p>
              <div style="text-align: center; margin: 30px 0;">
                <div style="background: white; border: 2px solid #667eea; border-radius: 5px; padding: 20px; display: inline-block;">
                  <h2 style="color: #667eea; margin: 0; font-size: 32px; letter-spacing: 5px;">${otp}</h2>
                </div>
              </div>
              <p style="font-size: 12px; color: #666;">
                This OTP will expire in 15 minutes. If you didn't request a password reset, please ignore this email.
              </p>
            </div>
            <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
              <p>&copy; ${new Date().getFullYear()} TrustiChain. All rights reserved.</p>
            </div>
          </body>
          </html>
        `,
        text: `
          Hi ${fullName},
          
          You requested to reset your password. Use this OTP code: ${otp}
          
          This OTP will expire in 15 minutes. If you didn't request a password reset, please ignore this email.
          
          © ${new Date().getFullYear()} TrustiChain. All rights reserved.
        `,
      });

      if (error) {
        console.error('Resend email error:', error);
        return { success: false, error: error.message || 'Failed to send email via Resend' };
      }

      console.log('Password reset OTP email sent successfully via Resend:', {
        id: data?.id,
        to: email,
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send password reset OTP email';
      console.error('Email sending error:', error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send escrow creation confirmation email to payer
   * @param email - Payer email address
   * @param payerName - Payer's full name
   * @param escrowId - Escrow ID (formatted as #ESC-YYYY-XXX)
   * @param amountXrp - Escrow amount in XRP
   * @param amountUsd - Escrow amount in USD
   * @param counterpartyName - Counterparty's name
   * @param expectedReleaseDate - Expected release date (optional)
   * @param description - Escrow description (optional)
   */
  async sendEscrowCreationConfirmationToPayer(
    email: string,
    payerName: string,
    escrowId: string,
    amountXrp: number,
    amountUsd: number,
    counterpartyName?: string,
    expectedReleaseDate?: string,
    description?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!resend) {
        const errorMsg = 'Resend API key not configured. Please set RESEND_API_KEY environment variable.';
        console.error(errorMsg);
        throw new Error(errorMsg);
      }

      if (!process.env.RESEND_FROM_EMAIL) {
        const errorMsg = 'Resend from email not configured. Please set RESEND_FROM_EMAIL environment variable.';
        console.error(errorMsg);
        throw new Error(errorMsg);
      }

      console.log(`Attempting to send escrow creation confirmation email to payer: ${email}`);

      const logoBase64 = this.getLogoBase64();
      const fontBase64 = this.getSatoshiFontBase64();
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const dashboardLink = `${frontendUrl}/dashboard`;
      const supportEmail = process.env.SUPPORT_EMAIL || 'support@trustichain.com';
      
      // Format expected release date if provided
      let formattedReleaseDate = '';
      if (expectedReleaseDate) {
        try {
          const releaseDate = new Date(expectedReleaseDate);
          formattedReleaseDate = releaseDate.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
        } catch (e) {
          formattedReleaseDate = expectedReleaseDate;
        }
      }

      // Format amount with currency symbol
      const amountDisplay = `${amountXrp.toFixed(6)} XRP / $${amountUsd.toFixed(2)} USD`;

      const { data, error } = await (resend as any).emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to: email,
        subject: `Escrow Created Successfully – ${escrowId}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Escrow Created Successfully</title>
            ${fontBase64 ? `
            <style>
              @font-face {
                font-family: 'Satoshi';
                src: url('${fontBase64}') format('opentype');
                font-weight: normal;
                font-style: normal;
              }
            </style>
            ` : ''}
          </head>
          <body style="font-family: ${fontBase64 ? "'Satoshi', " : ''}Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
            <!-- Header with Logo -->
            <div style="padding: 20px 0;">
              ${logoBase64 ? `<img src="${logoBase64}" alt="TrustiChain Logo" style="height: 40px; width: auto;" />` : '<h1 style="color: #333; margin: 0;">TrustiChain</h1>'}
            </div>
            
            <!-- Subject Line -->
            <h1 style="font-size: 24px; font-weight: bold; color: #333; margin: 20px 0;">Escrow Created Successfully – ${escrowId}</h1>
            
            <!-- Greeting -->
            <p style="font-size: 16px; color: #333; margin: 20px 0;">Dear ${payerName},</p>
            
            <!-- Main Message -->
            <p style="font-size: 16px; color: #333; margin: 20px 0;">We're excited to inform you that your escrow has been successfully created! 🎉</p>
            
            <!-- Escrow Details Box -->
            <div style="background-color: #f0f0f0; border-radius: 8px; padding: 20px; margin: 30px 0;">
              <p style="font-weight: bold; font-size: 16px; color: #333; margin: 0 0 15px 0;">Escrow Details:</p>
              <ul style="list-style: none; padding: 0; margin: 0;">
                <li style="margin: 10px 0; font-size: 14px; color: #333;"><strong>Transaction ID:</strong> ${escrowId}</li>
                <li style="margin: 10px 0; font-size: 14px; color: #333;"><strong>Amount:</strong> ${amountDisplay}</li>
                ${counterpartyName ? `<li style="margin: 10px 0; font-size: 14px; color: #333;"><strong>Payee:</strong> ${counterpartyName}</li>` : ''}
                ${formattedReleaseDate ? `<li style="margin: 10px 0; font-size: 14px; color: #333;"><strong>Expected Release Date:</strong> ${formattedReleaseDate}</li>` : ''}
                ${description ? `<li style="margin: 10px 0; font-size: 14px; color: #333;"><strong>Purpose/Description:</strong> ${description}</li>` : ''}
              </ul>
            </div>
            
            <!-- Information Paragraphs -->
            <p style="font-size: 14px; color: #666; margin: 20px 0; line-height: 1.8;">
              Your funds are now securely held in escrow and will be released according to the agreed terms. You can monitor the progress or make any updates by visiting your escrow dashboard: <a href="${dashboardLink}" style="color: #667eea; text-decoration: none;">${dashboardLink}</a>
            </p>
            
            <p style="font-size: 14px; color: #666; margin: 20px 0; line-height: 1.8;">
              If you have any questions or need assistance, our support team is here to help: <a href="mailto:${supportEmail}" style="color: #667eea; text-decoration: none;">${supportEmail}</a>
            </p>
            
            <p style="font-size: 14px; color: #666; margin: 20px 0;">Thank you for using TrustiChain</p>
            
            <!-- Closing -->
            <p style="font-size: 14px; color: #333; margin: 30px 0 10px 0;">Best Regards,</p>
            <p style="font-size: 14px; color: #333; margin: 0 0 20px 0;">Team TrustiChain</p>
            
            <p style="font-size: 12px; color: #999; margin: 30px 0 10px 0; font-style: italic;">This is a system generated message. Do not reply.</p>
            
            <!-- Footer -->
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;" />
            <div style="text-align: center; margin: 20px 0;">
              <!-- Social Media Icons (placeholder - you can add actual links) -->
              <div style="margin: 15px 0;">
                <a href="#" style="text-decoration: none; margin: 0 10px; color: #666; font-size: 20px;">🐦</a>
                <a href="#" style="text-decoration: none; margin: 0 10px; color: #666; font-size: 20px;">f</a>
                <a href="#" style="text-decoration: none; margin: 0 10px; color: #666; font-size: 20px;">in</a>
              </div>
              ${logoBase64 ? `<img src="${logoBase64}" alt="TrustiChain Logo" style="height: 30px; width: auto; margin-top: 15px;" />` : ''}
            </div>
          </body>
          </html>
        `,
        text: `
          Hi ${payerName},
          
          Your escrow has been created successfully on TrustiChain.
          
          Escrow ID: ${escrowId}
          Amount: ${amountXrp.toFixed(6)} XRP ($${amountUsd.toFixed(2)} USD)
          ${counterpartyName ? `Counterparty: ${counterpartyName}` : ''}
          
          You can track the status of this escrow in your TrustiChain dashboard.
          
          If you did not create this escrow, please contact support immediately.
          
          © ${new Date().getFullYear()} TrustiChain. All rights reserved.
        `,
      });

      if (error) {
        console.error('Resend email error:', error);
        return { success: false, error: error.message || 'Failed to send email via Resend' };
      }

      console.log('Escrow creation confirmation email sent successfully to payer:', {
        id: data?.id,
        to: email,
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send escrow creation confirmation email';
      console.error('Email sending error:', error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send escrow creation notification email to counterparty
   * @param email - Counterparty email address
   * @param counterpartyName - Counterparty's full name
   * @param escrowId - Escrow ID (formatted as #ESC-YYYY-XXX)
   * @param amountXrp - Escrow amount in XRP
   * @param amountUsd - Escrow amount in USD
   * @param payerName - Payer's name
   * @param expectedReleaseDate - Expected release date (optional)
   * @param description - Escrow description (optional)
   */
  async sendEscrowCreationNotificationToCounterparty(
    email: string,
    counterpartyName: string,
    escrowId: string,
    amountXrp: number,
    amountUsd: number,
    payerName?: string,
    expectedReleaseDate?: string,
    description?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!resend) {
        const errorMsg = 'Resend API key not configured. Please set RESEND_API_KEY environment variable.';
        console.error(errorMsg);
        throw new Error(errorMsg);
      }

      if (!process.env.RESEND_FROM_EMAIL) {
        const errorMsg = 'Resend from email not configured. Please set RESEND_FROM_EMAIL environment variable.';
        console.error(errorMsg);
        throw new Error(errorMsg);
      }

      console.log(`Attempting to send escrow creation notification email to counterparty: ${email}`);

      const logoBase64 = this.getLogoBase64();
      const fontBase64 = this.getSatoshiFontBase64();
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const dashboardLink = `${frontendUrl}/dashboard`;
      const supportEmail = process.env.SUPPORT_EMAIL || 'support@trustichain.com';
      
      // Format expected release date if provided
      let formattedReleaseDate = '';
      if (expectedReleaseDate) {
        try {
          const releaseDate = new Date(expectedReleaseDate);
          formattedReleaseDate = releaseDate.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
        } catch (e) {
          formattedReleaseDate = expectedReleaseDate;
        }
      }

      // Format amount with currency symbol
      const amountDisplay = `${amountXrp.toFixed(6)} XRP / $${amountUsd.toFixed(2)} USD`;

      const { data, error } = await (resend as any).emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to: email,
        subject: `Escrow Created Successfully – ${escrowId}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Escrow Created Successfully</title>
            ${fontBase64 ? `
            <style>
              @font-face {
                font-family: 'Satoshi';
                src: url('${fontBase64}') format('opentype');
                font-weight: normal;
                font-style: normal;
              }
            </style>
            ` : ''}
          </head>
          <body style="font-family: ${fontBase64 ? "'Satoshi', " : ''}Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
            <!-- Header with Logo -->
            <div style="padding: 20px 0;">
              ${logoBase64 ? `<img src="${logoBase64}" alt="TrustiChain Logo" style="height: 40px; width: auto;" />` : '<h1 style="color: #333; margin: 0;">TrustiChain</h1>'}
            </div>
            
            <!-- Subject Line -->
            <h1 style="font-size: 24px; font-weight: bold; color: #333; margin: 20px 0;">Escrow Created Successfully – ${escrowId}</h1>
            
            <!-- Greeting -->
            <p style="font-size: 16px; color: #333; margin: 20px 0;">Dear ${counterpartyName},</p>
            
            <!-- Main Message -->
            <p style="font-size: 16px; color: #333; margin: 20px 0;">We're excited to inform you that an escrow has been successfully created with you as the counterparty! 🎉</p>
            
            <!-- Escrow Details Box -->
            <div style="background-color: #f0f0f0; border-radius: 8px; padding: 20px; margin: 30px 0;">
              <p style="font-weight: bold; font-size: 16px; color: #333; margin: 0 0 15px 0;">Escrow Details:</p>
              <ul style="list-style: none; padding: 0; margin: 0;">
                <li style="margin: 10px 0; font-size: 14px; color: #333;"><strong>Transaction ID:</strong> ${escrowId}</li>
                <li style="margin: 10px 0; font-size: 14px; color: #333;"><strong>Amount:</strong> ${amountDisplay}</li>
                ${payerName ? `<li style="margin: 10px 0; font-size: 14px; color: #333;"><strong>Payer:</strong> ${payerName}</li>` : ''}
                ${formattedReleaseDate ? `<li style="margin: 10px 0; font-size: 14px; color: #333;"><strong>Expected Release Date:</strong> ${formattedReleaseDate}</li>` : ''}
                ${description ? `<li style="margin: 10px 0; font-size: 14px; color: #333;"><strong>Purpose/Description:</strong> ${description}</li>` : ''}
              </ul>
            </div>
            
            <!-- Information Paragraphs -->
            <p style="font-size: 14px; color: #666; margin: 20px 0; line-height: 1.8;">
              Your funds are now securely held in escrow and will be released according to the agreed terms. You can monitor the progress or make any updates by visiting your escrow dashboard: <a href="${dashboardLink}" style="color: #667eea; text-decoration: none;">${dashboardLink}</a>
            </p>
            
            <p style="font-size: 14px; color: #666; margin: 20px 0; line-height: 1.8;">
              If you have any questions or need assistance, our support team is here to help: <a href="mailto:${supportEmail}" style="color: #667eea; text-decoration: none;">${supportEmail}</a>
            </p>
            
            <p style="font-size: 14px; color: #666; margin: 20px 0;">Thank you for using TrustiChain</p>
            
            <!-- Closing -->
            <p style="font-size: 14px; color: #333; margin: 30px 0 10px 0;">Best Regards,</p>
            <p style="font-size: 14px; color: #333; margin: 0 0 20px 0;">Team TrustiChain</p>
            
            <p style="font-size: 12px; color: #999; margin: 30px 0 10px 0; font-style: italic;">This is a system generated message. Do not reply.</p>
            
            <!-- Footer -->
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;" />
            <div style="text-align: center; margin: 20px 0;">
              <!-- Social Media Icons (placeholder - you can add actual links) -->
              <div style="margin: 15px 0;">
                <a href="#" style="text-decoration: none; margin: 0 10px; color: #666; font-size: 20px;">🐦</a>
                <a href="#" style="text-decoration: none; margin: 0 10px; color: #666; font-size: 20px;">f</a>
                <a href="#" style="text-decoration: none; margin: 0 10px; color: #666; font-size: 20px;">in</a>
              </div>
              ${logoBase64 ? `<img src="${logoBase64}" alt="TrustiChain Logo" style="height: 30px; width: auto; margin-top: 15px;" />` : ''}
            </div>
          </body>
          </html>
        `,
        text: `
          Dear ${counterpartyName},
          
          We're excited to inform you that an escrow has been successfully created with you as the counterparty!
          
          Escrow Details:
          Transaction ID: ${escrowId}
          Amount: ${amountDisplay}
          ${payerName ? `Payer: ${payerName}` : ''}
          ${formattedReleaseDate ? `Expected Release Date: ${formattedReleaseDate}` : ''}
          ${description ? `Purpose/Description: ${description}` : ''}
          
          Your funds are now securely held in escrow and will be released according to the agreed terms. You can monitor the progress or make any updates by visiting your escrow dashboard: ${dashboardLink}
          
          If you have any questions or need assistance, our support team is here to help: ${supportEmail}
          
          Thank you for using TrustiChain
          
          Best Regards,
          Team TrustiChain
          
          This is a system generated message. Do not reply.
          
          © ${new Date().getFullYear()} TrustiChain. All rights reserved.
        `,
      });

      if (error) {
        console.error('Resend email error:', error);
        return { success: false, error: error.message || 'Failed to send email via Resend' };
      }

      console.log('Escrow creation notification email sent successfully to counterparty:', {
        id: data?.id,
        to: email,
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send escrow creation notification email';
      console.error('Email sending error:', error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send dispute notification email to respondent
   * @param email - Respondent email address
   * @param respondentName - Respondent's full name
   * @param disputeCaseId - Dispute case ID (e.g., #DSP-2025-001)
   * @param initiatorName - Name of the person who filed the dispute
   * @param disputeReason - Reason for the dispute
   * @param amountUsd - Dispute amount in USD
   */
  async sendDisputeNotificationToRespondent(
    email: string,
    respondentName: string,
    disputeCaseId: string,
    initiatorName: string,
    disputeReason: string,
    amountUsd: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!resend) {
        const errorMsg = 'Resend API key not configured. Please set RESEND_API_KEY environment variable.';
        console.error(errorMsg);
        throw new Error(errorMsg);
      }

      if (!process.env.RESEND_FROM_EMAIL) {
        const errorMsg = 'Resend from email not configured. Please set RESEND_FROM_EMAIL environment variable.';
        console.error(errorMsg);
        throw new Error(errorMsg);
      }

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const disputeLink = `${frontendUrl}/disputes/${disputeCaseId}`;

      console.log(`Attempting to send dispute notification email to respondent: ${email}`);

      const { data, error } = await (resend as any).emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to: email,
        subject: `Dispute Filed Against You - ${disputeCaseId} - TrustiChain`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Dispute Filed</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">Dispute Filed</h1>
            </div>
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
              <p>Hi ${respondentName},</p>
              <p>A dispute has been filed against you on TrustiChain. Please review the details below and take appropriate action.</p>
              <div style="background: white; border: 1px solid #ddd; border-radius: 5px; padding: 20px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Dispute Case ID:</strong> ${disputeCaseId}</p>
                <p style="margin: 5px 0;"><strong>Filed By:</strong> ${initiatorName}</p>
                <p style="margin: 5px 0;"><strong>Amount in Dispute:</strong> $${amountUsd.toFixed(2)} USD</p>
                <p style="margin: 5px 0;"><strong>Reason:</strong> ${disputeReason}</p>
              </div>
              <p>We encourage you to respond promptly and work towards a resolution. You can view the dispute details and respond through your TrustiChain dashboard.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${disputeLink}" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: white; 
                          padding: 15px 30px; 
                          text-decoration: none; 
                          border-radius: 5px; 
                          display: inline-block; 
                          font-weight: bold;">
                  View Dispute Details
                </a>
              </div>
              <p style="font-size: 12px; color: #666; margin-top: 30px;">
                Or copy and paste this link into your browser:<br>
                <a href="${disputeLink}" style="color: #667eea; word-break: break-all;">${disputeLink}</a>
              </p>
              <p style="font-size: 12px; color: #666;">
                If you believe this dispute was filed in error, please contact support immediately.
              </p>
            </div>
            <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
              <p>&copy; ${new Date().getFullYear()} TrustiChain. All rights reserved.</p>
            </div>
          </body>
          </html>
        `,
        text: `
          Hi ${respondentName},
          
          A dispute has been filed against you on TrustiChain.
          
          Dispute Case ID: ${disputeCaseId}
          Filed By: ${initiatorName}
          Amount in Dispute: $${amountUsd.toFixed(2)} USD
          Reason: ${disputeReason}
          
          We encourage you to respond promptly and work towards a resolution. You can view the dispute details and respond through your TrustiChain dashboard.
          
          View dispute: ${disputeLink}
          
          If you believe this dispute was filed in error, please contact support immediately.
          
          © ${new Date().getFullYear()} TrustiChain. All rights reserved.
        `,
      });

      if (error) {
        console.error('Resend email error:', error);
        return { success: false, error: error.message || 'Failed to send email via Resend' };
      }

      console.log('Dispute notification email sent successfully to respondent:', {
        id: data?.id,
        to: email,
        disputeCaseId,
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send dispute notification email';
      console.error('Email sending error:', error);
      return { success: false, error: errorMessage };
    }
  }
}

export const emailService = new EmailService();

