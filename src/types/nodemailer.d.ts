declare module "nodemailer" {
  type Auth = { user: string; pass: string };
  type TransportOptions = {
    host: string;
    port: number;
    secure?: boolean;
    auth?: Auth;
  };

  export interface SendMailOptions {
    from?: string;
    to?: string | string[];
    subject?: string;
    html?: string;
  }

  export interface Transporter {
    sendMail(options: SendMailOptions): Promise<any>;
  }

  export interface Nodemailer {
    createTransport(options: TransportOptions): Transporter;
  }

  const nodemailer: Nodemailer;
  export default nodemailer;
}
