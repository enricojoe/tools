interface QRPreviewProps {
  url: string
  size: number
}

export function QRPreview({ url, size }: QRPreviewProps) {
  return (
    <section className="preview" aria-label="Generated QR code">
      <img
        src={url}
        alt="Generated QR code"
        width={size}
        height={size}
        className="qr-image"
      />
      <a className="btn btn-secondary" href={url} download="qrcode.png">
        Download PNG
      </a>
    </section>
  )
}
