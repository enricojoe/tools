import { Icon } from '../../components/Icon'

interface QRPreviewProps {
  result: { url: string; size: number } | null
  loading: boolean
}

export function QRPreview({ result, loading }: QRPreviewProps) {
  return (
    <section
      className="card preview"
      aria-label="Generated QR code"
      aria-busy={loading}
    >
      {result ? (
        <>
          <img
            key={result.url}
            src={result.url}
            alt="Generated QR code"
            width={result.size}
            height={result.size}
            className="qr-image"
          />
          <a className="btn btn-secondary" href={result.url} download="qrcode.png">
            <Icon name="download" size={18} />
            Download PNG
          </a>
        </>
      ) : (
        <div className="preview-empty">
          <Icon name="sparkle" size={44} />
          <p>Your QR code will pop up here</p>
        </div>
      )}
    </section>
  )
}
