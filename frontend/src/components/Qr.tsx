import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

/** Renders `value` as a QR code PNG data-URL on a white rounded plate. */
export function Qr({ value, size = 256 }: { value: string; size?: number }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#1f1e1d', light: '#ffffff' },
    }).then(setSrc)
  }, [value, size])

  return (
    <div className="mx-auto w-fit rounded-2xl bg-white p-4 shadow-card">
      {src ? (
        <img src={src} width={size} height={size} alt="QR" />
      ) : (
        <div style={{ width: size, height: size }} />
      )}
    </div>
  )
}
