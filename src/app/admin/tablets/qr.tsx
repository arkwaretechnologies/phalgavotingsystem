import QRCodeLib from "qrcode";

export default async function QRCode({ value }: { value: string }) {
  const dataUrl = await QRCodeLib.toDataURL(value, {
    margin: 1,
    width: 220,
    errorCorrectionLevel: "M",
  });

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={dataUrl} alt="QR code" className="h-[220px] w-[220px]" />;
}

