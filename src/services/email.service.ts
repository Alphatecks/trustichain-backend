import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Gmail SMTP configuration with timeout settings
// Try port 465 (SSL) first, fallback to 587 (TLS)
const createTransporter = (useSSL = true) => {
  return nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: useSSL ? 465 : 587,
    secure: useSSL, // true for 465, false for 587
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD, // Use App Password, not regular password
    },
    connectionTimeout: 15000, // 15 seconds
    greetingTimeout: 15000, // 15 seconds
    socketTimeout: 15000, // 15 seconds
    tls: {
      rejectUnauthorized: false, // Allow self-signed certificates if needed
      ciphers: 'SSLv3',
    },
    debug: process.env.NODE_ENV === 'development', // Enable debug in dev
    logger: process.env.NODE_ENV === 'development', // Enable logging in dev
  });
};

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
      if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        const errorMsg = `Gmail credentials not configured. GMAIL_USER: ${!!process.env.GMAIL_USER}, GMAIL_APP_PASSWORD: ${!!process.env.GMAIL_APP_PASSWORD}`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }

      const backendUrl = process.env.BACKEND_URL || process.env.RENDER_URL || 'http://localhost:3000';
      // Link goes to backend GET endpoint, which verifies and redirects to frontend
      const verificationLink = `${backendUrl}/api/auth/verify-email?token=${verificationToken}`;

      console.log(`Attempting to send verification email to: ${email}`);
      console.log(`Using Gmail user: ${process.env.GMAIL_USER}`);
      console.log(`Backend URL: ${backendUrl}`);

      // Try SSL first (port 465), then fallback to TLS (port 587)
      let transporter = createTransporter(true); // Try SSL first
      let connectionWorked = false;

      // Try SSL connection first
      try {
        console.log('Trying Gmail SMTP with SSL (port 465)...');
        await Promise.race([
          transporter.verify(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('SMTP verification timeout')), 15000)
          )
        ]);
        console.log('Gmail SMTP connection verified successfully (SSL)');
        connectionWorked = true;
      } catch (sslError) {
        console.warn('SSL connection failed, trying TLS (port 587)...', sslError);
        // Try TLS instead
        transporter = createTransporter(false);
        try {
          await Promise.race([
            transporter.verify(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('SMTP verification timeout')), 15000)
            )
          ]);
          console.log('Gmail SMTP connection verified successfully (TLS)');
          connectionWorked = true;
        } catch (tlsError) {
          console.error('Both SSL and TLS connections failed:', tlsError);
          // Continue anyway - sometimes verify fails but sending works
          console.warn('Continuing with email send despite verification failure...');
        }
      }

      const mailOptions = {
        from: `"TrustiChain" <${process.env.GMAIL_USER}>`,
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
      };

      // Send email with timeout protection
      const info = await Promise.race([
        transporter.sendMail(mailOptions),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Email send timeout after 30 seconds')), 30000)
        )
      ]) as any;
      
      console.log('Verification email sent successfully:', {
        messageId: info.messageId,
        to: email,
        accepted: info.accepted,
        rejected: info.rejected,
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

