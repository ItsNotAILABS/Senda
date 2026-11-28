declare module "qrcode" {
  const QR: {
    toDataURL(text: string, options?: { margin?: number; width?: number; color?: { dark?: string; light?: string } }): Promise<string>;
  };
  export default QR;
}
