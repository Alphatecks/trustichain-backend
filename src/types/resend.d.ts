declare module 'resend' {
  export class Resend {
    constructor(apiKey: string);
    sendEmail(options: any): Promise<any>;
  }
}
