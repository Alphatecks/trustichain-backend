import { Resend } from 'resend';
import * as dotenv from 'dotenv';

dotenv.config();

// Initialize Resend client
const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export class EmailService {
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
}

export const emailService = new EmailService();

